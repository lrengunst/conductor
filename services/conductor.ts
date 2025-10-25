import type { Task, Work, Report } from '../types';

/**
 * @description  Một trình điều phối hiệu suất cao quản lý một bể chứa Web Worker cho các tác vụ song song.
 * @purpose      Trừu tượng hóa sự phức tạp của việc tạo, giao tiếp và quản lý vòng đời của worker, đặc biệt trong các môi trường không cho phép nạp worker từ URL động.
 * @solves       1. Đóng băng Giao diện Người dùng (UI Freeze) do các tác vụ tính toán nặng.
 *               2. Chi phí giao tiếp dữ liệu lớn giữa các luồng.
 *               3. Sử dụng không hiệu quả CPU đa lõi.
 *               4. Vấn đề bảo mật và bảo trì của việc thực thi mã động (`new Function`).
 * @model        Mô hình Bể chứa Worker (Worker Pool) và Sổ đăng ký Tác vụ (Task Registry).
 * @algorithm    Lập lịch tác vụ bằng hàng đợi FIFO (First-In, First-Out).
 * @complexity   Gửi tác vụ: O(1). Xử lý song song: Lý tưởng là O(N/P) với N là kích thước dữ liệu và P là số worker.
 * @rationale    Sử dụng một 'Sổ đăng ký tác vụ' (Task Registry) thay vì truyền mã dưới dạng chuỗi để thực thi giúp loại bỏ hoàn toàn rủi ro an ninh (Code Injection) và cải thiện đáng kể khả năng bảo trì và gỡ lỗi. Mã worker được xây dựng một lần lúc khởi tạo, kết hợp sổ đăng ký và logic lõi, sau đó được biến thành một URL đối tượng (Object URL) để tạo worker, giải quyết vấn đề của môi trường hạn chế.
 */
export class Conductor {
    private workers: Worker[] = [];
    private idle: number[] = [];
    private queue: Task[] = [];
    private tasks = new Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void }>();

    /**
     * @description Khởi tạo Conductor và tạo ra bể chứa worker.
     * @param {string} code Chuỗi mã nguồn của logic worker.
     * @param {object} registry Sổ đăng ký các hàm có thể thực thi.
     * @param {number} size Kích thước của bể chứa, mặc định là số lõi logic của CPU.
     */
    constructor(code: string, registry: object, size: number = navigator.hardwareConcurrency || 2) {
        const script = this.compile(registry, code);
        const blob = new Blob([script], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);

        for (let i = 0; i < size; i++) {
            const worker = new Worker(url);
            worker.onmessage = (event: MessageEvent<Report>) => this.finish(i, event.data);
            this.workers.push(worker);
            this.idle.push(i);
        }
        URL.revokeObjectURL(url);
    }

    /**
     * @description Gửi một tác vụ để thực thi trên một worker rảnh rỗi.
     * @param {string} name Tên của hàm cần thực thi, đã được đăng ký.
     * @param {any[]} args Các đối số cho hàm.
     * @returns {Promise<any>} Một promise sẽ resolve với kết quả của tác vụ.
     */
    submit(name: string, ...args: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = this.uid();
            const transfer = args.filter(arg => arg instanceof ArrayBuffer || (arg && arg.buffer instanceof ArrayBuffer))
                                .map(arg => arg.buffer instanceof ArrayBuffer ? arg.buffer : arg);
            
            // Xử lý trường hợp đối số là TypedArray, chuyển đổi về ArrayBuffer để chuyển giao
            const finalArgs = args.map(arg => {
                if (arg && arg.buffer instanceof ArrayBuffer && !(arg instanceof ArrayBuffer)) {
                    // Đây là một TypedArray, chúng ta cần tái tạo nó trong worker
                    return { __type: 'TypedArray', buffer: arg.buffer, constructor: arg.constructor.name };
                }
                return arg;
            });


            this.tasks.set(id, { resolve, reject });
            this.queue.push({ id, name, args: finalArgs, transfer, resolve, reject });
            this.dispatch();
        });
    }

    /**
     * @description Chấm dứt hoạt động của tất cả các worker trong pool.
     */
    terminate(): void {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
        this.idle = [];
        this.queue = [];
        this.tasks.clear();
    }

    /**
     * @description Phân phối một tác vụ từ hàng đợi đến một worker rảnh rỗi.
     * @private
     */
    private dispatch(): void {
        if (this.queue.length > 0 && this.idle.length > 0) {
            const task = this.queue.shift()!;
            const index = this.idle.shift()!;
            const work: Work = { id: task.id, name: task.name, args: task.args };

            this.workers[index].postMessage(work, task.transfer);
        }
    }

    /**
     * @description Xử lý khi một worker hoàn thành tác vụ.
     * @param {number} index Chỉ số của worker.
     * @param {Report} report Phản hồi từ worker.
     * @private
     */
    private finish(index: number, report: Report): void {
        const task = this.tasks.get(report.id);
        if (task) {
            if (report.error) {
                task.reject(new Error(report.error));
            } else {
                let result = report.result;
                // Tái tạo TypedArray từ buffer nếu cần
                 if (result && result.__type === 'TypedArray' && result.buffer) {
                    const constructor = self[result.constructor as keyof typeof self] as any;
                    if (constructor && typeof constructor === 'function') {
                       result = new constructor(result.buffer);
                    }
                }
                task.resolve(result);
            }
            this.tasks.delete(report.id);
        }
        this.idle.push(index);
        this.dispatch();
    }
    
    /**
     * @description Biên dịch sổ đăng ký và mã nguồn lõi thành một chuỗi script hoàn chỉnh.
     * @param {object} registry Đối tượng sổ đăng ký.
     * @param {string} code Mã nguồn lõi của worker.
     * @returns {string} Một chuỗi mã JavaScript sẵn sàng để thực thi.
     * @private
     */
    private compile(registry: object, code: string): string {
        const functions = Object.entries(registry)
            .map(([name, fn]) => `const ${name} = ${fn.toString()};`)
            .join('\n');
            
        const registryObject = `const registry = { ${Object.keys(registry).join(', ')} };`;
        
        // CẬP NHẬT: Gán registry vào scope toàn cục của worker (`self`)
        // để mã nguồn trong `code` có thể truy cập nó.
        const finalScript = `${functions}\n${registryObject}\n\nself.registry = registry;\n\n${code}`;

        return finalScript;
    }

    /**
     * @description Tạo một ID duy nhất cho mỗi tác vụ.
     * @returns {string} ID duy nhất.
     * @private
     */
    private uid(): string {
        return Math.random().toString(36).substring(2, 9);
    }
}