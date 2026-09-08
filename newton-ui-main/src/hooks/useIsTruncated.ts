import { useEffect, useRef, useState } from "react"

export function useIsTruncated(text: string) {
  const ref = useRef<HTMLElement | null>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  useEffect(() => {
    const checkTruncation = () => {
      if (ref.current) {
        const { scrollWidth, clientWidth } = ref.current
        setIsTruncated(scrollWidth > clientWidth)
      }
    }

    checkTruncation()

    // Recalculate on window resize so collapsing/expanding layouts
    // (like the sidebar) update tooltip visibility correctly.
    window.addEventListener("resize", checkTruncation)
    return () => {
      window.removeEventListener("resize", checkTruncation)
    }
  }, [text])

  return { ref, isTruncated }
}
