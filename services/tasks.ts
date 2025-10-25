
/**
 * @description Đảo ngược màu (R, G, B) của một khối dữ liệu ảnh.
 * @param {Uint8ClampedArray} data Khối dữ liệu ảnh, một phần của buffer lớn.
 * @returns {Uint8ClampedArray} Khối dữ liệu đã được xử lý.
 */
function invert(data: Uint8ClampedArray): Uint8ClampedArray {
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];       // R
        data[i + 1] = 255 - data[i + 1]; // G
        data[i + 2] = 255 - data[i + 2]; // B
        // Kênh Alpha (A) được giữ nguyên
    }
    return data;
}

/**
 * @description Làm mờ một vùng ảnh bằng thuật toán box blur đơn giản.
 * @param {object} payload Gói dữ liệu chứa buffer, chiều rộng và chiều cao.
 * @returns {Uint8ClampedArray} Dữ liệu ảnh đã được làm mờ.
 */
function blur({ data, width, height }: { data: Uint8ClampedArray, width: number, height: number }): Uint8ClampedArray {
    const output = new Uint8ClampedArray(data.length);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, a = 0;
            let count = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const i = (ny * width + nx) * 4;
                        r += data[i];
                        g += data[i + 1];
                        b += data[i + 2];
                        a += data[i + 3];
                        count++;
                    }
                }
            }
            const i = (y * width + x) * 4;
            output[i] = r / count;
            output[i + 1] = g / count;
            output[i + 2] = b / count;
            output[i + 3] = a / count;
        }
    }
    return output;
}


/**
 * @description Sổ đăng ký chứa tất cả các hàm có thể được gọi từ xa.
 *              Đây là cơ chế cốt lõi để tránh `new Function()` và đảm bảo an toàn.
 */
export const registry = {
    invert,
    blur,
};
