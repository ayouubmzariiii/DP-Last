// Static shim for `next/navigation` so App-Router components render in Claude Design's
// static React runtime (no Next router). Navigation is a no-op in a design preview.
export const useRouter = () => ({
    push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {},
})
export const useSearchParams = () => new URLSearchParams()
export const usePathname = () => '/'
export const useParams = () => ({} as Record<string, string>)
export const redirect = (_url?: string) => {}
export const notFound = () => {}
