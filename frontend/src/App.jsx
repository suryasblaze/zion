import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import Header from './components/Header'
import Footer from './components/Footer'
import CartDrawer from './components/CartDrawer'
import ChatDock from './components/ChatDock'

import Home from './pages/Home'
import Shop from './pages/Shop'
import Product from './pages/Product'
import Refer from './pages/Refer'
import Faq from './pages/Faq'
import Brewing from './pages/Brewing'
import OurRoots from './pages/OurRoots'
import ReferralCatch from './pages/ReferralCatch'
import EventSignup from './pages/EventSignup'
import Auth from './pages/Auth'
import Account from './pages/Account'
import Checkout from './pages/Checkout'
import NotFound from './pages/NotFound'

/* Admin is loaded on demand. Someone buying tea never fetches it. */
const AdminShell = lazy(() => import('./admin/AdminShell'))
const Dashboard = lazy(() => import('./admin/Dashboard'))
const AdminOrders = lazy(() => import('./admin/Orders'))
const AdminProducts = lazy(() => import('./admin/Products'))
const AdminCustomers = lazy(() => import('./admin/Customers'))
const AdminReferrals = lazy(() => import('./admin/Referrals'))
const AdminContent = lazy(() => import('./admin/Content'))
const Coupons = lazy(() => import('./admin/Content').then((m) => ({ default: m.Coupons })))
const AdminSettings = lazy(() => import('./admin/Settings'))
const DesignStudio = lazy(() => import('./admin/DesignStudio'))
const AdminEventSignups = lazy(() => import('./admin/EventSignups'))

function AdminLoading() {
  return <div className="grid min-h-screen place-items-center text-soft">Loading…</div>
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

/** The storefront chrome. The admin panel has its own, so it opts out. */
function Storefront({ children }) {
  return (
    <>
      <Header />
      <CartDrawer />
      <main id="main">{children}</main>
      <Footer />
      <ChatDock />
    </>
  )
}

export default function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80]
                   focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>

      <ScrollToTop />

      <Routes>
        {/* ------------------------------------------------ storefront */}
        <Route path="/" element={<Storefront><Home /></Storefront>} />
        <Route path="/shop" element={<Storefront><Shop /></Storefront>} />
        <Route path="/the-six" element={<Storefront><Shop /></Storefront>} />
        <Route path="/product/:slug" element={<Storefront><Product /></Storefront>} />
        <Route path="/our-roots" element={<Storefront><OurRoots /></Storefront>} />
        <Route path="/brewing" element={<Storefront><Brewing /></Storefront>} />
        <Route path="/refer" element={<Storefront><Refer /></Storefront>} />
        <Route path="/faq" element={<Storefront><Faq /></Storefront>} />
        {/* The event link. Short on purpose: it gets typed off a poster.
            Deliberately outside <Storefront>: no nav, no bag, no footer,
            no chat dock. Someone standing at a stall has one job, and
            every other link on the page is a way to not finish it. */}
        <Route path="/try" element={<EventSignup />} />
        <Route path="/checkout" element={<Storefront><Checkout /></Storefront>} />

        {/* accounts */}
        <Route path="/signin" element={<Storefront><Auth /></Storefront>} />
        {/* No public registration: accounts are made under Admin > Customers.
            Anyone with an old /signup link lands on sign-in instead. */}
        <Route path="/signup" element={<Navigate to="/signin" replace />} />
        <Route path="/account" element={<Storefront><Account /></Storefront>} />

        {/* referral links land here, get attributed, then invite a signup */}
        <Route path="/r/:code" element={<Storefront><ReferralCatch /></Storefront>} />

        {/* ----------------------------------------------------- admin */}
        <Route
          path="/admin"
          element={
            <Suspense fallback={<AdminLoading />}>
              <AdminShell />
            </Suspense>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="referrals" element={<AdminReferrals />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="design" element={<DesignStudio />} />
          <Route path="signups" element={<AdminEventSignups />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<Storefront><NotFound /></Storefront>} />
      </Routes>
    </>
  )
}
