import { CheckCircle, Printer, X } from 'lucide-react'

export default function TransactionCompleteModal({
  transactionId,
  date,
  time,
  cashierName,
  cartItems,
  subtotal,
  amountGiven,
  change,
  onPrintBill,
  onSkip,
  onClose,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[480px] max-w-[90vw] p-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Transaction Complete</h2>
              <p className="text-xs text-gray-500">{transactionId}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date / time */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <span>{date}</span>
          <span>{time}</span>
        </div>

        {/* Cashier */}
        <div className="text-sm text-gray-500 mb-3">
          Cashier: <span className="font-bold text-gray-900">{cashierName}</span>
        </div>

        <div className="border-t border-dashed border-gray-300 my-3" />

        {/* Items */}
        <div className="max-h-48 overflow-y-auto mb-1">
          {cartItems.map((item, index) => (
            <div key={index} className="flex items-start justify-between py-1.5">
              <div>
                <p className="text-sm font-bold text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {item.quantity} × Rs. {item.price.toFixed(2)}
                </p>
              </div>
              <p className="text-sm font-bold text-gray-900">
                Rs. {(item.quantity * item.price).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 my-3" />

        {/* Summary */}
        <div className="space-y-1.5 mb-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-900">Rs. {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Amount Given</span>
            <span className="text-gray-900">Rs. {amountGiven.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-bold text-gray-900">Change</span>
            <span className="font-bold text-green-600">Rs. {change.toFixed(2)}</span>
          </div>
        </div>

        <div className="border-t border-gray-200 my-3" />

        <p className="text-center text-xs text-gray-500 mb-3">Print the bill?</p>

        <button
          onClick={onPrintBill}
          className="w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white font-bold py-2.5 rounded-lg transition-colors mb-2"
        >
          <Printer className="w-4 h-4" />
          Print Bill
        </button>

        <button
          onClick={onSkip}
          className="w-full border-2 border-black text-black font-bold py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Skip, No Print
        </button>
      </div>
    </div>
  )
}
