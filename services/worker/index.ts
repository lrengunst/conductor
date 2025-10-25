// LƯU Ý QUAN TRỌNG:
// File này không phải là một module JavaScript thông thường.
// Nó sẽ được chuyển thành chuỗi và thực thi trong một môi trường worker.
// Biến 'registry' được giả định là đã tồn tại trong scope toàn cục của worker
// sau khi được "tiêm" vào bởi lớp Conductor.

declare const registry: { [key: string]: (...args: any[]) => any };

self.onmessage = (event: MessageEvent) => {
    const { id, name, args } = event.data;

    if (!id || !name) {
        console.error('Tác vụ không hợp lệ từ luồng chính:', event.data);
        return;
    }

    const fn = registry[name];
    if (typeof fn !== 'function') {
        self.postMessage({ id, error: `Tác vụ '${name}' không tồn tại trong sổ đăng ký.` });
        return;
    }

    try {
        // Tái tạo các TypedArray từ buffer được gửi đến
        const finalArgs = args.map((arg: any) => {
            if (arg && arg.__type === 'TypedArray' && arg.buffer) {
                const constructor = self[arg.constructor as keyof typeof self] as any;
                if (constructor && typeof constructor === 'function') {
                    return new constructor(arg.buffer);
                }
            }
            return arg;
        });

        const result = fn(...finalArgs);
        
        // Tự động tìm kiếm các đối tượng có thể chuyển giao (Transferable) trong kết quả
        let transferables: Transferable[] = [];
        let finalResult = result;

        if (result instanceof ArrayBuffer) {
            transferables.push(result);
        } else if (result && result.buffer instanceof ArrayBuffer) {
            // Dành cho TypedArrays như Uint8ClampedArray
            transferables.push(result.buffer);
            // Gửi lại dưới dạng có thể tái tạo
            finalResult = { __type: 'TypedArray', buffer: result.buffer, constructor: result.constructor.name };
        }
        
        self.postMessage({ id, result: finalResult }, { transfer: transferables });

    } catch (e: any) {
        self.postMessage({ id, error: e.message });
    }
};
