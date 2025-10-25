
/**
 * @description Định nghĩa cấu trúc của một tác vụ đang chờ trong hàng đợi.
 */
export interface Task {
  id: string;
  name: string;
  args: any[];
  transfer: Transferable[];
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

/**
 * @description Định nghĩa cấu trúc tin nhắn gửi đến worker.
 */
export interface Work {
  id: string;
  name: string;
  args: any[];
}

/**
 * @description Định nghĩa cấu trúc tin nhắn phản hồi từ worker.
 */
export interface Report {
  id: string;
  result?: any;
  error?: string;
}
