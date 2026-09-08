import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, ChevronsUpDown, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

export interface ComboboxOption {
  label: string
  value: string
}

function toOptions(raw?: ComboboxOption[] | string[]): ComboboxOption[] {
  if (!raw?.length) return []
  if (typeof raw[0] === "string") {
    return (raw as string[]).map((s) => ({ label: s, value: s }))
  }
  return raw as ComboboxOption[]
}

/** Popover-style combobox (multi-select with badges + trigger button). */
interface PopoverComboboxProps {
  options: string[] | ComboboxOption[]
  selectedValues: string[]
  onSelect: (value: string) => void
  onRemove: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  keepOpenOnSelect?: boolean
  multiSelectNoun?: string
  /** Hides the chip row above the trigger — trigger already shows count summary */
  compact?: boolean
}

/** Inline search-input combobox. */
interface InlineComboboxProps {
  options?: ComboboxOption[] | string[]
  /** @deprecated use `options` */
  items?: string[]
  selectedValues?: string[]
  /** @deprecated use `selectedValues` */
  defaultValue?: string[]
  onSelect?: ((items: string[]) => void) | ((item: string) => void)
  onSearch?: (
    query: string,
  ) => Promise<ComboboxOption[] | string[]> | ComboboxOption[] | string[]
  /** @deprecated use `onSearch` */
  onOpen?: (
    searchQuery?: string,
  ) => Promise<ComboboxOption[] | string[]> | ComboboxOption[] | string[]
  mode?: "single" | "multi"
  /** @deprecated use `mode` */
  multiple?: boolean
  debounceMs?: number
  /** @deprecated use `debounceMs` */
  searchDebounceMs?: number
  placement?: "top" | "bottom"
  /** @deprecated use `placement` */
  dropdownPlacement?: "top" | "bottom"
  loading?: boolean
  /** @deprecated use `loading` */
  isLoading?: boolean
  placeholder?: string
  disabled?: boolean
  inputId?: string
  inputClassName?: string
  className?: string
  required?: boolean
  enforceCommitFromList?: boolean
  onSingleSelectUncommittedClear?: () => void
  formatItemLabel?: (item: string) => string
}

export type ComboboxProps = PopoverComboboxProps | InlineComboboxProps

function isPopoverProps(props: ComboboxProps): props is PopoverComboboxProps {
  return "onRemove" in props && typeof props.onRemove === "function"
}

function PopoverCombobox({
  options,
  selectedValues,
  onSelect,
  onRemove,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No option found.",
  disabled = false,
  className,
  keepOpenOnSelect = false,
  multiSelectNoun = "services",
  compact = false,
}: PopoverComboboxProps) {
  const [open, setOpen] = useState(false)
  const normalized = useMemo(() => toOptions(options), [options])
  const labelByValue = useMemo(
    () => new Map(normalized.map((o) => [o.value, o.label])),
    [normalized],
  )
  const availableOptions = normalized.filter(
    (option) => !selectedValues.includes(option.value),
  )

  const displayLabel = (value: string) => labelByValue.get(value) ?? value

  return (
    <div className={cn("space-y-2", className)}>
      {!compact && selectedValues.length > 0 && (
        <div className="mb-2 flex max-h-24 flex-wrap gap-2 overflow-y-auto">
          {selectedValues.map((value) => (
            <Badge
              key={value}
              variant="secondary"
              className="flex items-center gap-1 border-border-main bg-background text-text-main"
            >
              {displayLabel(value)}
              <button
                type="button"
                onClick={() => {
                  if (!disabled) {
                    onRemove(value)
                  }
                }}
                className="ml-1 rounded-full p-0.5 hover:bg-surface"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-9 w-full justify-between border-border-main bg-background text-sm text-text-main hover:bg-surface"
            disabled={disabled}
          >
            <span className="truncate">
              {selectedValues.length === 0
                ? placeholder
                : selectedValues.length === 1
                  ? displayLabel(selectedValues[0])
                  : `${selectedValues.length} ${multiSelectNoun} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="pointer-events-auto z-[100] w-full p-0 bg-surface border-border-main"
          align="start"
        >
          <Command className="bg-surface">
            <CommandInput
              placeholder={searchPlaceholder}
              className="bg-surface text-text-main"
            />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {availableOptions.length === 0 && selectedValues.length > 0 ? (
                  <div className="px-2 py-1.5 text-sm text-text-muted">
                    All options selected
                  </div>
                ) : (
                  availableOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => {
                        onSelect(option.value)
                        if (!keepOpenOnSelect) {
                          setOpen(false)
                        }
                      }}
                      className="cursor-pointer text-text-main hover:bg-surface-2 data-[selected=true]:bg-surface-2"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedValues.includes(option.value)
                            ? "opacity-100 text-primary"
                            : "opacity-0",
                        )}
                      />
                      {option.label}
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

const DROPDOWN_MAX_H = 220

function InlineCombobox({
  options,
  items,
  selectedValues,
  defaultValue,
  onSelect,
  onSearch,
  onOpen,
  mode,
  multiple,
  debounceMs,
  searchDebounceMs,
  loading,
  isLoading: externalLoading = false,
  placeholder = "Search...",
  disabled = false,
  inputId,
  inputClassName,
  className,
  required = false,
  enforceCommitFromList = false,
  onSingleSelectUncommittedClear,
  formatItemLabel,
}: InlineComboboxProps) {
  const isMulti = mode ? mode === "multi" : multiple !== false
  const resolvedDebounce = debounceMs ?? searchDebounceMs ?? 300
  const resolvedSelected = selectedValues ?? defaultValue ?? []
  const staticOptions = useMemo(
    () => toOptions(options ?? items),
    [options, items],
  )
  const searchFn = onSearch ?? onOpen

  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedItems, setSelectedItems] = useState<string[]>(resolvedSelected)
  const [dropdownItems, setDropdownItems] = useState<ComboboxOption[]>([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [openFetchSettled, setOpenFetchSettled] = useState(false)

  // Portal positioning
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownElRef = useRef<HTMLDivElement>(null)

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const wasOpenRef = useRef(false)
  const searchFnRef = useRef(searchFn)
  searchFnRef.current = searchFn

  // Compute fixed position for portal dropdown
  const computePosition = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const showAbove = spaceBelow < DROPDOWN_MAX_H && spaceAbove > spaceBelow

    setDropdownStyle(
      showAbove
        ? {
            position: "fixed",
            bottom: window.innerHeight - rect.top + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 10000,
            pointerEvents: "auto",
          }
        : {
            position: "fixed",
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 10000,
            pointerEvents: "auto",
          },
    )
  }, [])

  useEffect(() => {
    if (!isOpen) return
    computePosition()
    window.addEventListener("scroll", computePosition, true)
    window.addEventListener("resize", computePosition)
    return () => {
      window.removeEventListener("scroll", computePosition, true)
      window.removeEventListener("resize", computePosition)
    }
  }, [isOpen, computePosition])

  // Portaled dropdowns sit outside Radix Dialog's RemoveScroll lock, which
  // preventDefaults wheel events. Manually apply scroll so the list stays usable.
  useEffect(() => {
    if (!isOpen) return

    const handleWheel = (event: WheelEvent) => {
      const dropdown = dropdownElRef.current
      if (!dropdown?.contains(event.target as Node)) return

      const scrollContainer = dropdown.querySelector<HTMLElement>(
        "[data-combobox-scroll]",
      )
      if (!scrollContainer) return

      const { scrollTop, scrollHeight, clientHeight } = scrollContainer
      if (scrollHeight <= clientHeight) return

      const next = Math.min(
        scrollHeight - clientHeight,
        Math.max(0, scrollTop + event.deltaY),
      )
      if (next !== scrollTop) {
        scrollContainer.scrollTop = next
        event.preventDefault()
      }
    }

    document.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    })
    return () => {
      document.removeEventListener("wheel", handleWheel, {
        capture: true,
      })
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedItems(resolvedSelected)
    if (!isMulti && resolvedSelected.length > 0) {
      setSearchQuery(resolvedSelected[0])
    } else if (!isMulti && resolvedSelected.length === 0) {
      setSearchQuery(required ? "Select an item" : "")
    }
  }, [resolvedSelected, isMulti, required])

  const fetchItems = useCallback(async (query: string = "") => {
    const loadItems = searchFnRef.current
    if (!loadItems) return

    setIsLoadingItems(true)
    try {
      const fetchedItems = await loadItems(query)
      setDropdownItems(toOptions(fetchedItems))
      setIsLoadingItems(false)
      setOpenFetchSettled(true)
    } catch (error) {
      console.error("Error fetching combobox items:", error)
      setDropdownItems([])
      setIsLoadingItems(false)
      setOpenFetchSettled(true)
    }
  }, [])

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    if (!isOpen || !searchFnRef.current) {
      wasOpenRef.current = false
      setOpenFetchSettled(false)
      return
    }

    const justOpened = !wasOpenRef.current
    wasOpenRef.current = true

    if (justOpened) {
      setOpenFetchSettled(false)
      fetchItems(searchQuery)
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchItems(searchQuery)
    }, resolvedDebounce)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [searchQuery, isOpen, fetchItems, resolvedDebounce])

  useEffect(() => {
    if (!searchFn) {
      setDropdownItems(staticOptions)
    }
  }, [staticOptions, searchFn])

  const filteredItems = dropdownItems.filter((item) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    const label = formatItemLabel ? formatItemLabel(item.value) : item.label
    return label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q)
  })

  const showLoading =
    externalLoading ||
    loading ||
    isLoadingItems ||
    (isOpen && !!searchFn && !openFetchSettled)
  const showEmptyState = !showLoading && filteredItems.length === 0

  // Click-outside: check both the input container and the portal dropdown
  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        containerRef.current?.contains(target) ||
        dropdownElRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-combobox-dropdown]"))
      ) {
        return
      }
      setIsOpen(false)
      if (!isMulti) {
        if (selectedItems.length > 0) {
          setSearchQuery(selectedItems[0])
        } else if (enforceCommitFromList && searchQuery.trim() !== "") {
          setSearchQuery("")
          onSingleSelectUncommittedClear?.()
        }
      }
    }

    document.addEventListener("pointerdown", handleClickOutside, true)
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside, true)
    }
  }, [isMulti, selectedItems, searchQuery, enforceCommitFromList, onSingleSelectUncommittedClear])

  const notifySelect = (values: string[]) => {
    if (onSelect) {
      ;(onSelect as (items: string[]) => void)(values)
    }
  }

  const handleSelect = (value: string) => {
    if (isMulti) {
      const newSelectedItems = selectedItems.includes(value)
        ? selectedItems.filter((selected) => selected !== value)
        : [...selectedItems, value]
      setSelectedItems(newSelectedItems)
      setSearchQuery("")
      notifySelect(newSelectedItems)
    } else {
      setSelectedItems([value])
      setSearchQuery(value)
      setIsOpen(false)
      notifySelect([value])
    }
  }

  const handleInputClick = () => {
    if (disabled) return
    setIsOpen(true)
    setSearchQuery("")
  }

  const displayItemLabel = (item: ComboboxOption) =>
    formatItemLabel ? formatItemLabel(item.value) : item.label

  const inputValue =
    !isMulti && !isOpen && selectedItems.length > 0
      ? formatItemLabel
        ? formatItemLabel(selectedItems[0])
        : selectedItems[0]
      : searchQuery

  const inputPlaceholder =
    !isMulti && selectedItems.length > 0 && !isOpen
      ? ""
      : selectedItems.length > 0 && (!isMulti || isOpen)
        ? ""
        : placeholder

  const dropdown = (
    <div
      ref={dropdownElRef}
      data-combobox-dropdown
      style={dropdownStyle}
      className="pointer-events-auto rounded-lg border border-border-main bg-surface shadow-lift animate-in fade-in-0 zoom-in-95"
    >
      <div
        data-combobox-scroll
        className="dropdown-scrollable-visible max-h-[200px] overflow-y-auto overscroll-contain"
      >
        <div className="p-1">
          {showLoading ? (
            <div className="px-3 py-8 text-center text-sm text-text-muted">
              Loading…
            </div>
          ) : filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const isSelected = selectedItems.includes(item.value)
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleSelect(item.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-text-main transition-colors duration-100 hover:bg-surface-2",
                    !isMulti && isSelected && "bg-primary/10 text-primary",
                  )}
                >
                  {isMulti && (
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors duration-100",
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-border-main bg-background",
                      )}
                    >
                      {isSelected && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </div>
                  )}
                  <span className="flex-1">{displayItemLabel(item)}</span>
                </button>
              )
            })
          ) : showEmptyState ? (
            <div className="px-3 py-8 text-center text-sm text-text-muted">
              {searchQuery ? "No results found" : "No items available"}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          id={inputId}
          name={inputId}
          value={inputValue}
          onChange={(e) => {
            if (disabled) return
            setSearchQuery(e.target.value)
            setIsOpen(true)
          }}
          onClick={handleInputClick}
          disabled={disabled}
          readOnly={disabled}
          placeholder={inputPlaceholder}
          className={cn(
            "w-full rounded-lg border border-border-main bg-background py-2.5 pl-10 pr-10 text-sm text-text-main transition-none placeholder:text-text-muted focus:border-primary/50 focus:outline-none focus:ring-0",
            disabled && "cursor-not-allowed opacity-75",
            inputClassName,
          )}
        />
        <ChevronDown
          onClick={(e) => {
            e.stopPropagation()
            if (disabled) return
            if (!isOpen) computePosition()
            setIsOpen(!isOpen)
          }}
          className={cn(
            "absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 cursor-pointer text-text-muted transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </div>

      {isOpen && createPortal(dropdown, document.body)}
    </div>
  )
}

export function Combobox(props: ComboboxProps) {
  if (isPopoverProps(props)) {
    return <PopoverCombobox {...props} />
  }
  return <InlineCombobox {...props} />
}
