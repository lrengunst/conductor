import React, { useState, useEffect, useCallback } from 'react';
import { Conductor } from './services/conductor';
import { registry } from './services/tasks';
import Card from './components/Card';
import Spinner from './components/Spinner';

const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/lrengunst/conductor/main/';

const App: React.FC = () => {
    const [status, setStatus] = useState<string>('Đang tải tài nguyên...');
    const [main, setMain] = useState<number | null>(null);
    const [parallel, setParallel] = useState<number | null>(null);
    const [processing, setProcessing] = useState(false);
    const [conductor, setConductor] = useState<Conductor | null>(null);

    useEffect(() => {
        const initialize = async () => {
            try {
                const cores = navigator.hardwareConcurrency || 4;
                setStatus(`Đang nạp mã nguồn worker từ GitHub...`);
                const conductorInstance = await Conductor.create(GITHUB_RAW_URL, cores);
                setConductor(conductorInstance);
                setStatus(`Sẵn sàng với ${cores} worker.`);
            } catch (error) {
                console.error("Lỗi khởi tạo Conductor:", error);
                setStatus('Lỗi khởi tạo. Vui lòng làm mới trang.');
            }
        };

        initialize();

        return () => {
            conductor?.terminate();
        };
    }, []); // Phụ thuộc rỗng để chỉ chạy một lần

    const process = useCallback(async (mode: 'main' | 'parallel') => {
        if (!conductor && mode === 'parallel') {
            setStatus("Lỗi: Conductor chưa được khởi tạo.");
            return;
        }

        setProcessing(true);
        setMain(null);
        setParallel(null);
        setStatus(`Đang chuẩn bị dữ liệu ảnh (2048x2048)...`);

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
            registry.invert(buffer);
            const end = performance.now();
            setMain(end - start);
            setStatus('Hoàn thành trên luồng chính.');
        } else if (mode === 'parallel' && conductor) {
            setStatus('Đang xử lý song song với workers...');
            await new Promise(resolve => setTimeout(resolve, 50));
            const cores = navigator.hardwareConcurrency || 4;
            const size = Math.ceil(buffer.length / cores);
            const promises = [];

            for (let i = 0; i < cores; i++) {
                const chunk = buffer.slice(i * size, (i + 1) * size);
                promises.push(conductor.submit('invert', chunk)); 
            }
            
            await Promise.all(promises);
            const end = performance.now();
            setParallel(end - start);
            setStatus('Hoàn thành xử lý song song.');
        }

        setProcessing(false);
    }, [conductor]);


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
                            disabled={!conductor || processing}
                            className="w-full md:w-1/2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105"
                        >
                           {processing && <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>}
                            Chạy trên Luồng chính (Sẽ đóng băng UI)
                        </button>
                        <button
                            onClick={() => process('parallel')}
                            disabled={!conductor || processing}
                            className="w-full md:w-1/2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105"
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