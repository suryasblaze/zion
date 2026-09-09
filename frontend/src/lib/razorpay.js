/**
 * Razorpay checkout.
 *
 * The script is fetched only when someone actually chooses to pay by card,
 * so the 90% of visitors paying cash on delivery never download it.
 *
 * Nothing here decides what an order costs. The server creates the
 * Razorpay order from its own `orders` row and returns the amount; this
 * file just opens the modal and hands the signed result back for
 * verification. A customer editing anything in the browser changes only
 * what they see, not what they are charged.
 */
import { api } from './api'

const SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js'

let loading = null

function loadScript() {
  if (window.Razorpay) return Promise.resolve(true)
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = SCRIPT
    el.async = true
    el.onload = () => resolve(true)
    el.onerror = () => {
      loading = null
      reject(new Error('Could not load the payment window. Check your connection.'))
    }
    document.body.appendChild(el)
  })
  return loading
}

/**
 * Open Razorpay for an order that already exists in our database.
 *
 * Resolves { status: 'paid' } once the payment is verified server-side,
 * or { status: 'dismissed' } if the customer closed the modal — which is
 * not an error, just an unfinished order they can return to.
 */
export async function payWithRazorpay({ orderNumber, customer = {}, accent }) {
  await loadScript()

  // The server builds this from its own record of the order.
  const session = await api.razorpayOrder({ order_number: orderNumber })

  return new Promise((resolve, reject) => {
    let settled = false

    const rzp = new window.Razorpay({
      key: session.key_id,
      order_id: session.razorpay_order_id,
      amount: session.amount,
      currency: session.currency,
      name: session.name || 'ZION Herbs',
      description: `Order ${session.order_number}`,
      image: '/brand/logo-dark.png',
      prefill: {
        name: customer.name || '',
        email: session.prefill?.email || customer.email || '',
        contact: session.prefill?.contact || customer.phone || '',
      },
      notes: { order_number: session.order_number },
      theme: { color: accent || '#8F7222' },

      handler: async (response) => {
        settled = true
        try {
          await api.razorpayVerify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          })
          resolve({ status: 'paid', paymentId: response.razorpay_payment_id })
        } catch (err) {
          // The money may well have left their account. The webhook is the
          // authority and will settle it, so say that rather than implying
          // the payment failed.
          resolve({
            status: 'pending',
            message:
              'Your payment went through but we could not confirm it here. ' +
              'It will appear in your orders shortly — do not pay again.',
          })
        }
      },

      modal: {
        ondismiss: () => {
          if (!settled) resolve({ status: 'dismissed' })
        },
      },
    })

    rzp.on('payment.failed', (e) => {
      settled = true
      const reason = e?.error?.description || 'The payment did not go through.'
      reject(new Error(`${reason} Your order is saved — you can try again.`))
    })

    rzp.open()
  })
}
