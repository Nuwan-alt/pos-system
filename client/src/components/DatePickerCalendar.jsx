import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']

function buildCalendarDays(year, month) {
  const firstDayOfWeek  = new Date(year, month, 1).getDay()
  const daysInMonth     = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const days = []
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    days.push({ d: new Date(year, month - 1, daysInPrevMonth - i), current: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ d: new Date(year, month, d), current: true })
  }
  let nextDay = 1
  while (days.length < 42) {
    days.push({ d: new Date(year, month + 1, nextDay++), current: false })
  }
  return days
}

// Renders the floating calendar dropdown.
// The parent is responsible for positioning (relative container + ref for click-outside).
export default function DatePickerCalendar({ selectedDate, onDateSelect }) {
  const today     = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  // Initialise to the selected date's month so reopening the calendar
  // lands on the month the user last picked.
  const [calendarYear,  setCalendarYear]  = useState(
    selectedDate ? selectedDate.getFullYear() : today.getFullYear()
  )
  const [calendarMonth, setCalendarMonth] = useState(
    selectedDate ? selectedDate.getMonth() : today.getMonth()
  )

  // Disable the "next" arrow once the user reaches the current month —
  // all dates beyond today are blocked anyway.
  const canGoNext = calendarYear < today.getFullYear() ||
    (calendarYear === today.getFullYear() && calendarMonth < today.getMonth())

  function prevMonth() {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1) }
    else setCalendarMonth(m => m - 1)
  }
  function nextMonth() {
    if (!canGoNext) return
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1) }
    else setCalendarMonth(m => m + 1)
  }

  const calendarDays = useMemo(
    () => buildCalendarDays(calendarYear, calendarMonth),
    [calendarYear, calendarMonth],
  )

  return (
    <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-[280px]">

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-600"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-gray-900">
          {MONTHS[calendarMonth]} {calendarYear}
        </span>
        <button
          onClick={nextMonth}
          disabled={!canGoNext}
          className={`p-1 rounded transition-colors ${
            canGoNext ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-200 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(day => (
          <div key={day} className="text-center text-xs font-semibold text-gray-400 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {calendarDays.map(({ d, current }, i) => {
          const isToday    = d.toDateString() === today.toDateString()
          const isSelected = selectedDate && d.toDateString() === selectedDate.toDateString()
          const isFuture   = d > todayStart
          return (
            <button
              key={i}
              disabled={isFuture}
              onClick={() => onDateSelect(d)}
              className={`
                flex items-center justify-center w-8 h-8 mx-auto rounded-full text-xs transition-colors
                ${isFuture
                  ? 'text-gray-200 cursor-not-allowed'
                  : isSelected
                    ? 'bg-[#111827] text-white font-bold'
                    : isToday
                      ? 'ring-2 ring-gray-900 text-gray-900 font-semibold hover:bg-gray-100'
                      : current
                        ? 'text-gray-900 hover:bg-gray-100'
                        : 'text-gray-300 hover:bg-gray-50'
                }
              `}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
