import type { Task, Work, Report } from '../../types';

/**
 * @description  Một trình điều phối hiệu suất cao quản lý một bể chứa Web Worker cho các tác vụ song song.
 * @purpose      Trừu tượng hóa sự phức tạp của việc tạo, giao tiếp và quản lý vòng đời của worker, đặc biệt trong các môi trường không cho phép nạp worker từ URL động.
 * @solves       1. Đóng băng Giao diện Người dùng (UI Freeze) do các tác vụ tính toán nặng.
 *               2. Chi phí giao tiếp dữ liệu lớn giữa các luồng.
 *               3. Sử dụng không hiệu quả CPU đa lõi.
 *               4. Vấn đề bảo mật và bảo trì của việc thực thi mã động.
 *               5. Sự khó khăn trong việc phát triển mã nguồn worker khi phải nhúng dưới dạng chuỗi.
 * @model        Mô hình Bể chứa Worker (Worker Pool), Sổ đăng ký Tác vụ (Task Registry), và Trình nạp Động (Dynamic Loader).
 * @algorithm    Lập lịch tác vụ bằng hàng đợi FIFO (First-In, First-Out).
 * @complexity   Khởi tạo: O(1) + chi phí mạng. Gửi tác vụ: O(1). Xử lý song song: Lý tưởng là O(N/P).
 * @rationale    Sử dụng một phương thức factory `async static create` để nạp mã nguồn từ một URL ổn định. Điều này cho phép mã nguồn worker và tasks được phát triển như các module tiêu chuẩn, cải thiện đáng kể khả năng bảo trì và trải nghiệm lập trình viên. Mã nguồn sau khi được nạp sẽ được biên dịch tại trình duyệt thành một Blob URL, giải quyết hoàn toàn vấn đề của môi trường hạn chế.
 */
export class Conductor {
    private workers: Worker[] = [];
    private idle: number[] = [];
    private queue: Task[] = [];
    private tasks = new Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void }>();

    /**
     * @description Tạo và khởi tạo một instance Conductor.
     * @param {string} baseUrl URL gốc để nạp mã nguồn.
     * @param {number} size Kích thước của bể chứa worker.
     * @returns {Promise<Conductor>} Một promise sẽ resolve với instance Conductor đã sẵn sàng.
     */
    public static async create(baseUrl: string, size: number = navigator.hardwareConcurrency || 2): Promise<Conductor> {
        const [workerCode, tasksCode] = await Promise.all([
            fetch(`${baseUrl}services/worker/index.js`).then(res => res.text()),
            fetch(`${baseUrl}services/tasks/index.js`).then(res => res.text()),
        ]);
        return new Conductor(workerCode, tasksCode, size);
    }

    /**
     * @description Constructor là private để ép buộc việc sử dụng phương thức `create` bất đồng bộ.
     * @param {string} workerCode Chuỗi mã nguồn của logic worker.
     * @param {string} tasksCode Chuỗi mã nguồn của sổ đăng ký tác vụ.
     * @param {number} size Kích thước của bể chứa.
     * @private
     */
    private constructor(workerCode: string, tasksCode: string, size: number) {
        const script = this.compile(tasksCode, workerCode);
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
            
            const finalArgs = args.map(arg => {
                if (arg && arg.buffer instanceof ArrayBuffer && !(arg instanceof ArrayBuffer)) {
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
     * @description Biên dịch mã nguồn của tasks và worker thành một script hoàn chỉnh.
     * @param {string} tasksCode Mã nguồn của file tasks.
     * @param {string} workerCode Mã nguồn lõi của worker.
     * @returns {string} Một chuỗi mã JavaScript sẵn sàng để thực thi.
     * @private
     */
    private compile(tasksCode: string, workerCode: string): string {
        // Loại bỏ các từ khóa `export` để chạy trong worker scope
        const cleanTasksCode = tasksCode.replace(/export /g, '');
        
        const finalScript = `${cleanTasksCode}\n\nself.registry = registry;\n\n${workerCode}`;

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