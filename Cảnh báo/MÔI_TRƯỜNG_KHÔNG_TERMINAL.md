# Cảnh Báo: Môi Trường Phát Triển Không Có Terminal

Môi trường hiện tại là một sandbox chạy hoàn toàn trên trình duyệt, được thiết kế để phát triển frontend một cách nhanh chóng và cô lập. Do đó, nó có một số giới hạn quan trọng so với môi trường phát triển cục bộ (local development):

**Không có Giao diện Dòng lệnh (Terminal/CLI):**

1.  **Không có Trình quản lý Gói (npm, yarn, pnpm):** Bạn không thể chạy các lệnh như `npm install` hoặc `yarn add` để cài đặt các thư viện từ registry. Mọi phụ thuộc (dependencies) phải được nạp thông qua:
    *   **CDN (Content Delivery Network):** Sử dụng thẻ `<script>` trong `index.html` hoặc `importmap` để trỏ đến các URL của thư viện (ví dụ: React, Lodash từ unpkg, esm.sh).
    *   **Mã nguồn được cung cấp sẵn:** Dán trực tiếp mã nguồn của thư viện vào một file trong dự án.

2.  **Không có Công cụ Xây dựng (Build Tools):** Các công cụ như Webpack, Vite, Rollup, Parcel, hay Babel không thể được chạy. Điều này có nghĩa là:
    *   Không có quá trình "build" hoặc "compile". Mã bạn viết là mã chạy trực tiếp trên trình duyệt.
    *   Các tính năng nâng cao như Tree Shaking, Code Splitting tự động, hay transpiling mã ESNext sang ES5 phải được xử lý thủ công hoặc không có sẵn.
    *   Các cú pháp đặc thù của bundler (ví dụ: `import styles from './style.css';` hoặc `import '!!raw-loader!...'`) sẽ gây lỗi.

3.  **Không có Lệnh Hệ thống Tệp (File System Commands):** Bạn không thể chạy các lệnh như `ls`, `mkdir`, `cp`, `rm` để thao tác với cấu trúc thư mục. Mọi thay đổi phải được thực hiện thông qua giao diện của môi trường phát triển.

**Tư duy cần thiết:** Hãy xem môi trường này như một trang `index.html` tĩnh có khả năng nạp các module JavaScript. Mọi logic phải được chứa trong các file JavaScript này và tương thích 100% với trình duyệt mà không cần bất kỳ bước tiền xử lý nào.
