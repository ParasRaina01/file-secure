"use client"

// Inspired by react-hot-toast library
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

type ToastState = {
  toasts: ToasterToast[]
}

export const toastState = {
  toasts: [],
} as ToastState

export function useToast() {
  const [state, setState] = React.useState<ToastState>(toastState)

  React.useEffect(() => {
    toastState.toasts = state.toasts
  }, [state.toasts])

  function toast({ ...props }: Omit<ToasterToast, "id">) {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast = { ...props, id }

    setState((state) => {
      const newToasts = [...state.toasts]

      if (newToasts.length > TOAST_LIMIT - 1) {
        newToasts.shift()
      }

      return {
        ...state,
        toasts: [...newToasts, newToast],
      }
    })

    return {
      id,
      dismiss: () => dismiss(id),
      update: (props: ToasterToast) => update(id, props),
    }
  }

  function update(id: string, props: ToasterToast) {
    if (!id) return

    setState((state) => ({
      ...state,
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, ...props } : t
      ),
    }))
  }

  function dismiss(id: string) {
    if (!id) return

    setState((state) => ({
      ...state,
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  }

  return {
    ...state,
    toast,
    dismiss,
  }
}
