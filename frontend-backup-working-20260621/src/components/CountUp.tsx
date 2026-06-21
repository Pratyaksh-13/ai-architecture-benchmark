import { useEffect, useState } from 'react'

interface Props {
  value: number
  duration?: number
  formatter?: (v: number) => string
}

export default function CountUp({ value, duration = 600, formatter }: Props) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    // Respect user's preferences for reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setDisplayValue(value)
      return
    }

    let start = 0
    const end = value
    if (start === end) {
      setDisplayValue(end)
      return
    }

    const startTime = performance.now()

    let animationFrameId: number

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Quadratic ease-out formula
      const ease = progress * (2 - progress)
      const current = start + (end - start) * ease
      setDisplayValue(current)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate)
      } else {
        setDisplayValue(end)
      }
    }

    animationFrameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [value, duration])

  const formatted = formatter ? formatter(displayValue) : Math.round(displayValue).toString()

  return <span>{formatted}</span>
}
