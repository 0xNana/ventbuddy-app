import { toast } from 'sonner';

/**
 * Safe toast wrapper that prevents setState during render warnings
 * by deferring toast calls to the next tick
 */
export const safeToast = {
  success: (message: string) => {
    setTimeout(() => toast.success(message), 0);
  },
  error: (message: string) => {
    setTimeout(() => toast.error(message), 0);
  },
  info: (message: string) => {
    setTimeout(() => toast.info(message), 0);
  },
  warning: (message: string) => {
    setTimeout(() => toast.warning(message), 0);
  },
  loading: (message: string) => {
    setTimeout(() => toast.loading(message), 0);
  },
  dismiss: (toastId?: string | number) => {
    setTimeout(() => toast.dismiss(toastId), 0);
  },
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return toast.promise(promise, messages);
  }
};
