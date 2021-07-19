import { useEffect } from 'react';
import { useRef } from 'react';
import { createContext, ReactNode, useContext, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { Product } from '../types';

interface CartProviderProps {
  children: ReactNode;
}

interface UpdateProductAmount {
  productId: number;
  amount: number;
}

interface CartContextData {
  cart: Product[];
  addProduct: (productId: number) => Promise<void>;
  removeProduct: (productId: number) => void;
  updateProductAmount: ({ productId, amount }: UpdateProductAmount) => void;
}

const CartContext = createContext<CartContextData>({} as CartContextData);

export function CartProvider({ children }: CartProviderProps): JSX.Element {
  const [cart, setCart] = useState<Product[]>(() => {
    const storagedCart = localStorage.getItem('@RocketShoes:cart');

    if (storagedCart) {
      return JSON.parse(storagedCart);
    }

    return [];
  });

  const previousCartRef = useRef<Product[]>();

  useEffect(() => {
    previousCartRef.current = cart;
  });

  // a primeira vez que o useEffect rodar, o previousCartRef vai estar undefined e o useState vai entender como se o
  // valor atual fosse diferente do anterior e faria um setItem. Como não quero isso, vou colocar um coalescing operator
  const cartPreviousValue = previousCartRef.current ?? cart;
  useEffect(() => {
    if (cartPreviousValue != cart) {
      localStorage.setItem('@RocketShoes:cart', JSON.stringify(cart));
    }
  }, [cart, cartPreviousValue]);

  const addProduct = async (productId: number) => {
    try {
      const updatedCart = [...cart];
      const productExistsInCart = updatedCart.find(product => product.id === productId);

      const stockItem = await api.get(`/stock/${productId}`);
      const stockItemAmount = stockItem.data.amount;

      const currentAmount = productExistsInCart ? productExistsInCart.amount : 0;
      const newAmount = currentAmount + 1;

      if (newAmount > stockItemAmount) {
        toast.error('Quantidade solicitada fora de estoque');
        return;
      }

      if (productExistsInCart) {
        productExistsInCart.amount = newAmount
      } else {
        const getNewProduct = await api.get(`/products/${productId}`);
        const newProduct = {
          ...getNewProduct.data,
          amount: 1,
        }

        updatedCart.push(newProduct);
      }
      setCart(updatedCart);

    } catch {
      toast.error('Erro na adição do produto');
    }
  };

  const removeProduct = (productId: number) => {
    try {
      const updatedCart = [...cart]; // imutabilidade
      const productIndex = updatedCart.findIndex(product => product.id === productId);

      if (productIndex >= 0) {
        const product = updatedCart[productIndex]
        const newAmount = product.amount - 1;

        updatedCart.splice(productIndex, 1);

        setCart(updatedCart);

      } else {
        throw Error();
      }

    } catch {
      toast.error('Erro na remoção do produto');
    }
  };

  const updateProductAmount = async ({
    productId,
    amount,
  }: UpdateProductAmount) => {
    try {
      if (amount <= 0) {
        return;
      }

      const stock = await api.get(`/stock/${productId}`);
      const stockAmount = stock.data.amount;

      if (amount > stockAmount) {
        toast.error('Quantidade solicitada fora de estoque');
        return;
      }

      const updatedCart = [...cart];
      const productExists = updatedCart.find(product => product.id === productId);

      if (productExists) {
        productExists.amount = amount;

        setCart(updatedCart);
      } else {
        throw Error();
      }

    } catch {
      toast.error('Erro na alteração de quantidade do produto');
    }
  };

  return (
    <CartContext.Provider
      value={{ cart, addProduct, removeProduct, updateProductAmount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextData {
  const context = useContext(CartContext);

  return context;
}
