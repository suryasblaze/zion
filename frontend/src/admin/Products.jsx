import { useState } from 'react'
import Collection from './Collection'
import { PageHead } from './AdminShell'

const TABS = [
  ['products', 'Products'],
  ['product_variants', 'Pack sizes and stock'],
  ['categories', 'Categories'],
]

export default function Products() {
  const [tab, setTab] = useState('products')

  return (
    <>
      <PageHead
        title="Products"
        sub="The catalogue. Prices and stock live under pack sizes, because one tea has several."
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <div className="p-6 lg:p-9">
        <Collection key={tab} table={tab} embedded />
      </div>
    </>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="border-b border-line px-6 lg:px-9">
      <div className="flex gap-7 overflow-x-auto">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`whitespace-nowrap border-b-2 py-3.5 text-[0.92rem] transition-colors ${
              value === key ? 'border-gold text-gold' : 'border-transparent text-soft hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
