export function printBill(transaction) {
  const billNo = transaction.transactionId.slice(-7)
  const totalItems = transaction.cartItems.reduce((sum, i) => sum + i.quantity, 0)
  const totalDiscount = transaction.cartItems.reduce((sum, i) => sum + ((i.discount || 0) * i.quantity), 0)

  const itemsHTML = transaction.cartItems.map(item => `
    <div class="item-name">${item.name.toUpperCase()}</div>
    <div class="item-row">
      <span>${item.price.toFixed(2)}</span>
      <span>${(item.discount || 0).toFixed(2)}</span>
      <span>${item.quantity}</span>
      <span>${(item.price * item.quantity).toFixed(2)}</span>
    </div>
  `).join('<div class="divider-dashed"></div>')

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt</title>
      <style>
        /* Without this, the browser prints at its default page size (A4/
           Letter) regardless of the receipt printer's actual roll — the
           printer then dutifully feeds out that entire page length, mostly
           blank, for every single bill. "auto" height makes the printed
           page shrink to fit the receipt's actual content instead.
           Adjust 80mm below to 58mm if that's this printer's roll width. */
        @page {
          size: 80mm auto;
          margin: 0;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          /* 72mm, not 76mm — this printer's actual printable width on an
             80mm roll is narrower than the roll itself (the print head
             can't reach all the way to either physical edge), so content
             sized right up to 76mm was getting clipped on the right. */
          width: 72mm;
          margin: 0 auto;
          padding: 3mm;
        }
        .center { text-align: center; }
        .store-name { font-size: 18px; font-weight: bold; text-align: center; }
        .store-info { text-align: center; margin-bottom: 6px; }
        .meta-row { display: flex; justify-content: space-between; margin: 2px 0; }
        .meta-row > span { white-space: nowrap; }
        .label { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .col-header { display: flex; justify-content: space-between; font-weight: bold; }
        .item-name { font-weight: bold; margin-top: 4px; }
        .item-row { display: flex; justify-content: space-between; margin: 2px 0 4px 0; }
        .summary-row { display: flex; justify-content: space-between; margin: 2px 0; }
        .summary-row.bold { font-weight: bold; font-size: 14px; }
        .footer { text-align: center; margin-top: 8px; font-style: italic; }
      </style>
    </head>
    <body>
      <div class="store-name">G.C.L TRADERS</div>
      <div class="store-info">Horana Road, Kottawa<br/>076 0121893</div>
      <div class="divider"></div>
      <div class="meta-row"><span><span class="label">DATE</span> &nbsp; ${transaction.date}</span><span><span class="label">TIME</span> &nbsp; ${transaction.time}</span></div>
      <div class="meta-row"><span><span class="label">USER</span> &nbsp; ${transaction.cashierName}</span><span><span class="label">BILL NO</span> &nbsp; ${billNo}</span></div>
      <div class="meta-row"><span class="label">CUS</span></div>
      <div class="divider"></div>
      <div class="col-header">
        <span>PRICE</span><span>DIS</span><span>QTY</span><span>AMOUNT</span>
      </div>
      <div class="divider"></div>
      ${itemsHTML}
      <div class="divider"></div>
      <div class="summary-row bold"><span>BILL TOTAL</span><span>${transaction.subtotal.toFixed(2)}</span></div>
      <div class="summary-row"><span class="label">CASH</span><span>${transaction.amountGiven.toFixed(2)}</span></div>
      <div class="summary-row"><span class="label">BALANCE</span><span>${transaction.change.toFixed(2)}</span></div>
      <div class="summary-row"><span class="label">PAYMENT METHOD</span><span>${transaction.paymentMethod || 'Cash'}</span></div>
      <div class="summary-row"><span class="label">CARD VALUE</span><span>${(transaction.cardValue || 0).toFixed(2)}</span></div>
      <div class="summary-row"><span class="label">NO OF ITEMS</span><span>${totalItems}</span></div>
      <div class="summary-row"><span class="label">TOTAL DISCOUNT</span><span>${totalDiscount.toFixed(2)}</span></div>
      <div class="divider"></div>
      <div class="footer">Thank you come again..!</div>
    </body>
    </html>
  `

  const popupWidth = Math.round(window.screen.availWidth / 2)
  const popupHeight = window.screen.availHeight
  const popupLeft = window.screen.availWidth - popupWidth
  const printWindow = window.open(
    '',
    '_blank',
    `width=${popupWidth},height=${popupHeight},left=${popupLeft},top=0`
  )
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.onafterprint = () => printWindow.close()
  printWindow.focus()
  printWindow.print()
}
