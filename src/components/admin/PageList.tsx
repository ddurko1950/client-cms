import Link from 'next/link'

interface PageListItem {
  _id: string
  slug: string
  title: string
  publishedVersion: number | null
}

export function PageList({ pages }: { pages: PageListItem[] }) {
  return (
    <ul className="divide-y">
      {pages.map((page) => (
        <li key={page._id} className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium">{page.title}</p>
            <p className="text-sm text-gray-500">/{page.slug}</p>
            <p className="text-xs text-gray-400">
              {page.publishedVersion ? `Published v${page.publishedVersion}` : 'Unpublished'}
            </p>
          </div>
          <Link href={`/admin/pages/${page._id}/edit`} className="text-sm underline">
            Edit
          </Link>
        </li>
      ))}
    </ul>
  )
}
