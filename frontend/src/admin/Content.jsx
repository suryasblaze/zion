import { useEffect, useState } from 'react'
import Collection from './Collection'
import { Tabs } from './Products'
import { PageHead, Pill } from './AdminShell'
import { adminApi } from './adminApi'
import { SCHEMAS } from './schemas'

const TABS = [
  ['faqs', 'Questions'],
  ['pages', 'Pages'],
  ['nav_items', 'Menus'],
  ['page_sections', 'Homepage sections'],
  ['testimonials', 'Testimonials'],
  ['reviews', 'Reviews'],
  ['locations', 'Locations'],
  ['redirects', 'Redirects'],
  ['messages', 'Inbox'],
]

export default function Content() {
  const [tab, setTab] = useState('faqs')

  return (
    <>
      <PageHead
        title="Content"
        sub="The words on the site. Questions here are also published as structured data, which is what search engines and AI assistants read."
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <div className="p-6 lg:p-9">
        {tab === 'messages' ? <Inbox /> : <Collection key={tab} table={tab} embedded />}
      </div>
    </>
  )
}

function Inbox() {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    adminApi.messages().then(setRows).catch(() => setRows([]))
  }, [])

  if (!rows) return <p className="py-12 text-center text-soft">Loading…</p>
  if (!rows.length)
    return (
      <div className="border border-line bg-paper py-16 text-center">
        <p className="font-display text-[1.2rem]">Nothing in the inbox</p>
        <p className="mt-2 text-soft">Messages from the contact form land here.</p>
      </div>
    )

  return (
    <div className="grid gap-px border border-line bg-line">
      {rows.map((m) => (
        <article key={m.id} className="bg-paper p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[0.95rem]">{m.name}</p>
              <p className="text-tiny text-soft">
                {m.email}
                {m.phone && ` · ${m.phone}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Pill tone={m.status === 'new' ? 'gold' : 'neutral'}>{m.status}</Pill>
              <span className="nums text-tiny text-soft">
                {new Date(m.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </span>
            </div>
          </div>
          {m.subject && <p className="mt-3 text-[0.95rem]">{m.subject}</p>}
          <p className="mt-2 max-w-[74ch] text-soft">{m.message}</p>
          <a
            href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || 'your message'}`)}`}
            className="mt-3 inline-block border-b border-gold pb-0.5 text-tiny text-gold"
          >
            Reply by email
          </a>
        </article>
      ))}
    </div>
  )
}

export function Coupons() {
  return (
    <>
      <PageHead title={SCHEMAS.coupons.title} sub={SCHEMAS.coupons.sub} />
      <div className="p-6 lg:p-9">
        <Collection table="coupons" embedded />
      </div>
    </>
  )
}
