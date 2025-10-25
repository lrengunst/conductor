import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Conductor } from './services/conductor';
import { registry } from './services/tasks';
import Card from './components/Card';
import Spinner from './components/Spinner';

// GIẢI PHÁP: Nhúng trực tiếp mã nguồn của worker vào đây dưới dạng một chuỗi.
// Điều này loại bỏ sự phụ thuộc vào các trình nạp (loader) đặc thù của bundler.
const workerCode = `
// LƯU Ý QUAN TRỌNG:
// File này không phải là một module JavaScript thông thường.
// Nó sẽ được chuyển thành chuỗi và thực thi trong một môi trường worker.
// Biến 'registry' được giả định là đã tồn tại trong scope toàn cục của worker
// sau khi được "tiêm" vào bởi lớp Conductor.

self.onmessage = (event) => {
    const { id, name, args } = event.data;

    if (!id || !name) {
        console.error('Tác vụ không hợp lệ từ luồng chính:', event.data);
        return;
    }
    
    // Giả định 'registry' đã được định nghĩa trong scope này bởi Conductor.
    const fn = self.registry[name];
    if (typeof fn !== 'function') {
        self.postMessage({ id, error: \`Tác vụ '\${name}' không tồn tại trong sổ đăng ký.\` });
        return;
    }

    try {
        const result = fn(...args);
        
        const transferables = [];
        if (result instanceof ArrayBuffer) {
            transferables.push(result);
        } else if (result && result.buffer instanceof ArrayBuffer) {
            transferables.push(result.buffer);
        }

        self.postMessage({ id, result }, { transfer: transferables });

    } catch (e) {
        self.postMessage({ id, error: e.message });
    }
};
`;


const App: React.FC = () => {
    const [status, setStatus] = useState<string>('Sẵn sàng');
    const [main, setMain] = useState<number | null>(null);
    const [parallel, setParallel] = useState<number | null>(null);
    const [processing, setProcessing] = useState(false);
    const conductor = useRef<Conductor | null>(null);

    useEffect(() => {
        // Khởi tạo Conductor một lần khi component được mount
        const cores = navigator.hardwareConcurrency || 4;
        setStatus(`Khởi tạo Conductor với ${cores} worker...`);
        conductor.current = new Conductor(workerCode, registry, cores);
        setStatus('Sẵn sàng');

        // Dọn dẹp khi component unmount
        return () => {
            conductor.current?.terminate();
            setStatus('Đã dọn dẹp');
        };
    }, []);

    const process = useCallback(async (mode: 'main' | 'parallel') => {
        setProcessing(true);
        setMain(null);
        setParallel(null);
        setStatus(`Đang chuẩn bị dữ liệu ảnh (2048x2048)...`);

        // Sử dụng `setTimeout` để cho phép UI cập nhật trước khi bắt đầu tác vụ nặng
        await new Promise(resolve => setTimeout(resolve, 50));

        const width = 2048;
        const height = 2048;
        const buffer = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < buffer.length; i++) {
            buffer[i] = (i % 256);
        }

        const start = performance.now();

        if (mode === 'main') {
            setStatus('Đang xử lý trên luồng chính...');
            await new Promise(resolve => setTimeout(resolve, 50));
            registry.invert(buffer); // Chạy trực tiếp
            const end = performance.now();
            setMain(end - start);
            setStatus('Hoàn thành trên luồng chính.');
        } else if (mode === 'parallel' && conductor.current) {
            setStatus('Đang xử lý song song với workers...');
            await new Promise(resolve => setTimeout(resolve, 50));
            const c = conductor.current;
            const cores = navigator.hardwareConcurrency || 4;
            const size = Math.ceil(buffer.length / cores);
            const promises = [];

            for (let i = 0; i < cores; i++) {
                const chunk = buffer.slice(i * size, (i + 1) * size);
                // Chúng ta cần gửi ArrayBuffer, không phải TypedArray, để có thể chuyển giao.
                promises.push(c.submit('invert', chunk.buffer)); 
            }
            
            await Promise.all(promises);
            const end = performance.now();
            setParallel(end - start);
            setStatus('Hoàn thành xử lý song song.');
        }

        setProcessing(false);
    }, []);


    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-4xl mx-auto space-y-8">
                <header className="text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">Conductor</span>
                    </h1>
                    <p className="mt-2 text-lg text-gray-400">Trình diễn xử lý song song với Web Worker</p>
                    <p className="mt-4 text-sm bg-gray-800 rounded-full px-4 py-1 inline-block border border-gray-700">{status}</p>
                </header>

                <main className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        <button
                            onClick={() => process('main')}
                            disabled={processing}
                            className="w-full md:w-1/2 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105"
                        >
                           {processing && <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>}
                            Chạy trên Luồng chính (Sẽ đóng băng UI)
                        </button>
                        <button
                            onClick={() => process('parallel')}
                            disabled={processing}
                            className="w-full md:w-1/2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-900 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105"
                        >
                            {processing && <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>}
                            Chạy song song với Conductor
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Kết quả Luồng Chính">
                            <div className="flex items-center justify-center h-24">
                                {main === null ? (
                                    <span className="text-gray-500">Chưa chạy</span>
                                ) : (
                                    <p className="text-3xl font-mono text-red-400">{main.toFixed(2)} ms</p>
                                )}
                            </div>
                        </Card>
                        <Card title="Kết quả Song song">
                           <div className="flex items-center justify-center h-24">
                                {parallel === null ? (
                                    <span className="text-gray-500">Chưa chạy</span>
                                ) : (
                                    <p className="text-3xl font-mono text-green-400">{parallel.toFixed(2)} ms</p>
                                )}
                            </div>
                        </Card>
                    </div>
                     {parallel && main && (
                        <Card title="So sánh hiệu năng">
                            <div className="text-center">
                                <p className="text-2xl">
                                    Xử lý song song nhanh hơn 
                                    <span className="font-bold text-yellow-400 mx-2 text-3xl">
                                        {(main / parallel).toFixed(2)}
                                    </span> 
                                    lần!
                                </p>
                                <p className="text-gray-400 mt-2">Quan trọng hơn, giao diện người dùng không bị đóng băng trong quá trình xử lý song song.</p>
                            </div>
                        </Card>
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;
