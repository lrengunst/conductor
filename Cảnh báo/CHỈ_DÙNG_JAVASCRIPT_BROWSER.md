# Cảnh Báo: Chỉ Sử dụng Mã JavaScript Tương thích với Trình duyệt

Môi trường này thực thi mã của bạn trực tiếp trong trình duyệt (client-side), không có sự can thiệp của một môi trường phía máy chủ (server-side) như Node.js. Điều này áp đặt một quy tắc nền tảng: **Mọi dòng mã bạn viết phải là JavaScript mà trình duyệt có thể hiểu được.**

**Những điều Bị cấm Tuyệt đối:**

1.  **API của Node.js:** Bạn không thể sử dụng bất kỳ module lõi nào của Node.js. Các lệnh gọi sau sẽ gây ra lỗi `ReferenceError`:
    *   `const fs = require('fs');`
    *   `const path = require('path');`
    *   `const http = require('http');`
    *   `process.env.SOME_VAR` (Đối tượng `process` không tồn tại)

2.  **Hệ thống Module CommonJS:** Cú pháp `require()` và `module.exports` không phải là một phần của tiêu chuẩn JavaScript trên trình duyệt. Bạn phải sử dụng **ES Modules** (`import` và `export`).

3.  **Phụ thuộc vào Môi trường Server:** Bất kỳ mã nào giả định rằng nó đang chạy trên một máy chủ, có quyền truy cập vào hệ thống tệp cục bộ, hoặc có thể mở các kết nối mạng cấp thấp đều sẽ thất bại.

**Những gì Được phép và Khuyến khích:**

1.  **API Web tiêu chuẩn:** Tất cả các API do trình duyệt cung cấp đều có sẵn:
    *   **DOM Manipulation:** `document.getElementById`, `createElement`, ...
    *   **Fetch API:** Để thực hiện các yêu cầu HTTP đến các máy chủ khác.
    *   **Web Workers:** Để xử lý đa luồng.
    *   **LocalStorage / SessionStorage / IndexedDB:** Để lưu trữ dữ liệu phía client.
    *   **Canvas API:** Để vẽ đồ họa 2D.
    *   `console`, `setTimeout`, `setInterval`, ...

2.  **ES Modules (`import`/`export`):** Sử dụng cú pháp module tiêu chuẩn để tổ chức mã nguồn của bạn. Môi trường này hỗ trợ `importmap` trong `index.html` để quản lý các phụ thuộc từ CDN.

3.  **Thư viện Frontend:** Các thư viện và framework được thiết kế để chạy trên trình duyệt như React, Vue, Svelte, Lodash, D3.js, Three.js, v.v. đều hoàn toàn tương thích, miễn là chúng được nạp đúng cách (thường là qua CDN).

**Tóm lại:** Khi viết mã, hãy luôn tự hỏi: "Đoạn mã này có thể chạy trong thẻ `<script>` của một file HTML tĩnh không?". Nếu câu trả lời là có, nó sẽ hoạt động tốt trong môi trường này.
