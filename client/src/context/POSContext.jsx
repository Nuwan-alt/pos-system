import { createContext, useContext, useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'

const POSContext = createContext(null)

export function POSProvider({ children }) {
  const [products, setProducts] = useState([])
  const [cashiers, setCashiers] = useState([])

  const refetchProducts = () =>
    apiFetch('/api/products').then(setProducts).catch(() => {})

  const refetchCashiers = () =>
    apiFetch('/api/cashiers/active').then(setCashiers).catch(() => {})

  useEffect(() => {
    refetchProducts()
    refetchCashiers()
  }, [])

  const updateProductStock = (productId, quantityToAdd) => {
    setProducts(prev =>
      prev.map(p =>
        p.id === productId
          ? { ...p, stock: p.stock + quantityToAdd }
          : p
      )
    )
  }

  return (
    <POSContext.Provider value={{ products, cashiers, updateProductStock, refetchProducts, refetchCashiers }}>
      {children}
    </POSContext.Provider>
  )
}

export function usePOS() {
  return useContext(POSContext)
}
