import { useEffect, useState } from 'react'

interface Props {
  children: React.ReactNode
}

export default function PageTransition({ children }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Check user preference for reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced) {
      setVisible(true)
      return
    }

    const t = setTimeout(() => {
      setVisible(true)
    }, 30)

    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={`transition-all duration-200 ease-out transform ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {children}
    </div>
  )
}
