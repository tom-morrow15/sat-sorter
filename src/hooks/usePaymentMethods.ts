import { useLocalStorage } from './useLocalStorage';

export const PAYMENT_METHODS_STORAGE = 'sat-sorter:payment-methods';

export function usePaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useLocalStorage<string[]>(
    PAYMENT_METHODS_STORAGE,
    []
  );

  const addPaymentMethod = (method: string) => {
    const trimmed = method.trim();
    if (!trimmed) return;
    if (paymentMethods.includes(trimmed)) return;
    setPaymentMethods([...paymentMethods, trimmed]);
  };

  const removePaymentMethod = (method: string) => {
    setPaymentMethods(paymentMethods.filter(m => m !== method));
  };

  const updatePaymentMethod = (oldMethod: string, newMethod: string) => {
    const trimmed = newMethod.trim();
    if (!trimmed || trimmed === oldMethod) return;
    setPaymentMethods(
      paymentMethods.map(m => (m === oldMethod ? trimmed : m))
    );
  };

  return {
    paymentMethods,
    addPaymentMethod,
    removePaymentMethod,
    updatePaymentMethod,
  };
}
