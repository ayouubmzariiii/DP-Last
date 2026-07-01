// Static shim for `next/link` → a plain anchor, so components using <Link> render statically.
import React from 'react'

export default function Link({ href, children, ...rest }: { href?: unknown; children?: React.ReactNode } & Record<string, unknown>) {
    return <a href={typeof href === 'string' ? href : '#'} {...(rest as Record<string, unknown>)}>{children as React.ReactNode}</a>
}
