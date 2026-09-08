import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Circle,
  CalendarClock,
  Timer,
  Trophy,
  UserCheck,
  Sparkles,
  BellRing,
  Zap,
  Star,
  ShieldCheck,
  ActivitySquare,
  LucideIcon,
} from 'lucide-react';

interface CalendarEvent {
  date: string;
  title: string;
  status: 'ongoing' | 'upcoming' | 'enrolled' | 'completed';
  start_date: string;
  end_date: string;
  event_id: number;
  type: string;
}

interface CalendarProps {
  events: CalendarEvent[];
}

type StatusVisual = {
  icon: LucideIcon;
  colorStyle: React.CSSProperties;
};

const Calendar: React.FC<CalendarProps> = ({ events }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const defaultType = 'General';
  const defaultStatus = 'Unspecified';

  const uniqueTypes = useMemo(() => {
    const collected = events.map(event => event.type?.trim() || defaultType);
    return collected.length ? Array.from(new Set(collected)) : [defaultType];
  }, [events]);

  const typeColorMap = useMemo(() => {
    const typeColors = [
      { bg: 'rgb(var(--color-info) / 0.15)', border: 'rgb(var(--color-info) / 0.4)' },
      { bg: 'rgb(var(--color-success) / 0.15)', border: 'rgb(var(--color-success) / 0.4)' },
      { bg: 'rgb(var(--color-entity-doc-tag) / 0.15)', border: 'rgb(var(--color-entity-doc-tag) / 0.4)' },
      { bg: 'rgb(var(--color-warning) / 0.15)', border: 'rgb(var(--color-warning) / 0.4)' },
      { bg: 'rgb(var(--color-accent) / 0.15)', border: 'rgb(var(--color-accent) / 0.4)' },
      { bg: 'rgb(var(--color-entity-datasource) / 0.15)', border: 'rgb(var(--color-entity-datasource) / 0.4)' },
      { bg: 'rgb(var(--color-primary) / 0.15)', border: 'rgb(var(--color-primary) / 0.4)' },
      { bg: 'rgb(var(--color-secondary) / 0.15)', border: 'rgb(var(--color-secondary) / 0.4)' },
    ];
    
    return uniqueTypes.reduce<Record<string, React.CSSProperties>>((acc, type, index) => {
      const colorSet = typeColors[index % typeColors.length];
      acc[type] = {
        backgroundColor: colorSet.bg,
        borderColor: colorSet.border,
      };
      return acc;
    }, {});
  }, [uniqueTypes]);

  const uniqueStatuses = useMemo(() => {
    const collected = events.map(event => event.status?.trim() || defaultStatus);
    return collected.length ? Array.from(new Set(collected)) : [defaultStatus];
  }, [events]);

  const statusVisualMap = useMemo(() => {
    const canonicalVisuals: Record<string, StatusVisual> = {
      ongoing: { 
        icon: Timer, 
        colorStyle: { color: 'rgb(var(--color-success))' } 
      },
      upcoming: { 
        icon: CalendarClock, 
        colorStyle: { color: 'rgb(var(--color-info))' } 
      },
      enrolled: { 
        icon: UserCheck, 
        colorStyle: { color: 'rgb(var(--color-warning))' } 
      },
      completed: { 
        icon: Trophy, 
        colorStyle: { color: 'rgb(var(--color-primary))' } 
      },
    };

    const fallbackIcons: LucideIcon[] = [Sparkles, BellRing, Zap, Star, ShieldCheck, ActivitySquare];
    const fallbackColors = [
      'rgb(var(--color-primary))',
      'rgb(var(--color-success))',
      'rgb(var(--color-warning))',
      'rgb(var(--color-error))',
      'rgb(var(--color-info, var(--color-primary)))',
      'rgb(var(--color-text-secondary))',
    ];

    return uniqueStatuses.reduce<Record<string, StatusVisual>>((acc, status, index) => {
      const normalized = status.toLowerCase();
      if (canonicalVisuals[normalized]) {
        acc[status] = canonicalVisuals[normalized];
      } else {
        acc[status] = {
          icon: fallbackIcons[index % fallbackIcons.length] || Circle,
          colorStyle: { color: fallbackColors[index % fallbackColors.length] || 'rgb(var(--color-text-secondary))' }
        };
      }
      return acc;
    }, {});
  }, [uniqueStatuses]);

  const getTypeStyle = (type: string): React.CSSProperties => {
    return typeColorMap[type] || {
      backgroundColor: 'rgb(var(--color-surface, var(--color-background)))',
      borderColor: 'rgb(var(--color-border, var(--color-text-secondary)))',
    };
  };

  
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };
  
  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };
  
  const formatDateForComparison = (date: Date) => {
    return date.toISOString().split('T')[0];
  };
  
  const getEventsForDate = (date: Date) => {
    const dateStr = formatDateForComparison(date);
    return events.filter(event => {
      const eventStart = new Date(event.start_date);
      const eventEnd = new Date(event.end_date);
      const currentDate = new Date(dateStr);
      
      return currentDate >= eventStart && currentDate <= eventEnd;
    });
  };
  
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };
  
  const toggleDayExpansion = (dateKey: string) => {
    setExpandedDays(prev => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };
  
  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];
    
    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div 
          key={`empty-${i}`} 
          className="h-20 sm:h-24 md:h-28 border border-solid" 
          style={{ 
            borderColor: 'rgb(var(--color-text-secondary))',
            borderWidth: '1px',
          }}
        ></div>
      );
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateKey = formatDateForComparison(date);
      const dayEvents = getEventsForDate(date);
      const isExpanded = !!expandedDays[dateKey];
      const eventsToDisplay = isExpanded ? dayEvents : dayEvents.slice(0, 3);
      const isToday = formatDateForComparison(date) === formatDateForComparison(new Date());
      
      const hasEvents = dayEvents.length > 0;
      
      days.push(
        <div
          key={day}
          className="h-20 sm:h-24 md:h-28 border border-solid p-0.5 sm:p-1 transition-colors flex flex-col"
          style={{
            borderColor: 'rgb(var(--color-border))',
            borderWidth: '1px',
            backgroundColor: 'rgb(var(--color-surface, var(--color-background)))',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgb(var(--color-surface))';
            e.currentTarget.style.filter = 'brightness(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgb(var(--color-surface))';
            e.currentTarget.style.filter = 'brightness(1)';
          }}
        >
          <div 
            className="text-2xs sm:text-xs md:text-sm font-medium mb-0.5 flex-shrink-0"
            style={{ color: isToday ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text))' }}
          >
            {day}
          </div>
          <div
            className="space-y-0.5 flex-1 overflow-y-auto min-h-0"
            style={{ maxHeight: 'calc(100% - 1.5rem)' }}
          >
            {hasEvents ? (
              <>
                {eventsToDisplay.map((event, index) => {
                  const eventType = event.type?.trim() || defaultType;
                  const eventStatus = event.status?.trim() || defaultStatus;
                  const statusVisual = statusVisualMap[eventStatus] || { 
                    icon: Circle, 
                    colorStyle: { color: 'rgb(var(--color-text-secondary))' } 
                  };
                  const StatusIcon = statusVisual.icon;
                  const typeStyle = getTypeStyle(eventType);

                  return (
                  <div
                    key={`${event.event_id}-${index}`}
                      className="flex items-center gap-0.5 text-3xs sm:text-2xs md:text-xs px-0.5 py-0.5 rounded border border-solid"
                      style={{
                        backgroundColor: typeStyle.backgroundColor,
                        borderColor: typeStyle.borderColor,
                        borderWidth: '1px',
                      }}
                      title={`${event.title} • ${eventType} • ${eventStatus}`}
                    >
                      <StatusIcon 
                        className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 flex-shrink-0" 
                        style={statusVisual.colorStyle}
                      />
                      <span 
                        className=""
                        style={{ color: 'rgb(var(--color-text))' }}
                      >
                        {event.title}
                      </span>
                    </div>
                  );
                })}
                {!isExpanded && dayEvents.length > eventsToDisplay.length && (
                  <button
                    type="button"
                    className="text-3xs sm:text-2xs md:text-xs underline underline-offset-1"
                    style={{ color: 'rgb(var(--color-primary))' }}
                    onClick={() => toggleDayExpansion(dateKey)}
                  >
                    +{dayEvents.length - eventsToDisplay.length} more
                  </button>
                )}
                {isExpanded && dayEvents.length > 2 && (
                  <button
                    type="button"
                    className="text-3xs sm:text-2xs md:text-xs underline underline-offset-1"
                    style={{ color: 'rgb(var(--color-text-secondary))' }}
                    onClick={() => toggleDayExpansion(dateKey)}
                  >
                    Show less
                  </button>
                )}
              </>
            ) : null}
          </div>
        </div>
      );
    }
    
    return days;
  };
  
  return (
    <>
      <style>{`
        .calendar-container .border {
          border-color: rgb(var(--color-border)) !important;
        }
        /* Ensure borders are always visible by using text-secondary as visible fallback */
        .calendar-container [class*="border"] {
          border-color: rgb(var(--color-border, var(--color-text-secondary))) !important;
        }
      `}</style>
      <div 
        className="calendar-container rounded-lg border border-solid p-2 sm:p-3 md:p-4 w-full max-w-4xl mx-auto"
        style={{
          backgroundColor: 'rgb(var(--color-surface, var(--color-background)))',
          borderColor: 'rgb(var(--color-border))',
          borderWidth: '1px',
        }}
      >
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4 gap-1 sm:gap-2">
        <div className="flex items-center space-x-1 sm:space-x-2 min-w-0 flex-1">
          <CalendarIcon 
            className="flex-shrink-0" 
            size={16}
            style={{ color: 'rgb(var(--color-primary))' }}
          />
          <h3 
            className="text-xs sm:text-sm md:text-lg font-semibold truncate"
            style={{ color: 'rgb(var(--color-text))' }}
          >
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
        </div>
        <div className="flex items-center space-x-0.5 sm:space-x-1 md:space-x-2 flex-shrink-0">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-1 sm:p-1.5 md:p-2 rounded transition-colors"
            style={{ 
              color: 'rgb(var(--color-text-secondary))',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(var(--color-surface))';
              e.currentTarget.style.filter = 'brightness(1.2)';
              e.currentTarget.style.color = 'rgb(var(--color-text))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.filter = 'brightness(1)';
              e.currentTarget.style.color = 'rgb(var(--color-text-secondary))';
            }}
          >
            <ChevronLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-2xs sm:text-xs md:text-sm rounded transition-colors"
            style={{
              backgroundColor: 'rgb(var(--color-primary))',
              color: 'rgb(var(--color-background))',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'brightness(1)';
            }}
          >
            Today
          </button>
          <button
            onClick={() => navigateMonth('next')}
            className="p-1 sm:p-1.5 md:p-2 rounded transition-colors"
            style={{ 
              color: 'rgb(var(--color-text-secondary))',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(var(--color-surface))';
              e.currentTarget.style.filter = 'brightness(1.2)';
              e.currentTarget.style.color = 'rgb(var(--color-text))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.filter = 'brightness(1)';
              e.currentTarget.style.color = 'rgb(var(--color-text-secondary))';
            }}
          >
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
          </button>
        </div>
      </div>
      
      {/* Days of Week Header */}
      <div className="scrollbar-calendar overflow-x-auto -mx-2 sm:mx-0">
        <div className="grid grid-cols-7 gap-0 mb-2 w-full">
        {daysOfWeek.map(day => (
            <div 
              key={day} 
              className="p-1 sm:p-2 text-center text-2xs sm:text-xs md:text-sm font-semibold border border-solid"
              style={{
                color: 'rgb(var(--color-text-secondary, var(--color-text)))',
                borderColor: 'rgb(var(--color-border, var(--color-text-secondary)))',
                borderWidth: '1px',
                backgroundColor: 'rgb(var(--color-surface, var(--color-background)))',
              }}
            >
            {day}
          </div>
        ))}
        </div>
      </div>
      
      {/* Calendar Grid */}
      <div className="scrollbar-calendar overflow-x-auto -mx-2 sm:mx-0">
        <div
          className="scrollbar-calendar grid grid-cols-7 gap-0 w-full h-[15rem] sm:h-[18rem] md:h-[21rem] overflow-y-auto pr-1 sm:pr-2 md:pr-3"
          style={{
            scrollbarGutter: 'stable both-edges',
          }}
        >
        {renderCalendarDays()}
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-2 sm:mt-3 md:mt-4 grid grid-cols-1 gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm md:grid-cols-2">
        <div>
          <p 
            className="font-semibold mb-1 sm:mb-1.5 md:mb-2 text-2xs sm:text-xs md:text-sm"
            style={{ color: 'rgb(var(--color-text-secondary))' }}
          >
            Event Types
          </p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-3">
            {uniqueTypes.map(type => {
              const typeStyle = getTypeStyle(type);
              return (
                <div 
                  key={type} 
                  className="flex items-center gap-1 sm:gap-1.5 md:gap-2 text-3xs sm:text-2xs md:text-xs"
                  style={{ color: 'rgb(var(--color-text))' }}
                >
                  <span 
                    className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full border border-solid flex-shrink-0"
                    style={{
                      ...typeStyle,
                      borderWidth: '1px',
                    }}
                  ></span>
                  <span className="truncate">{type}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <p 
            className="font-semibold mb-1 sm:mb-1.5 md:mb-2 text-2xs sm:text-xs md:text-sm"
            style={{ color: 'rgb(var(--color-text-secondary))' }}
          >
            Statuses
          </p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-3">
            {uniqueStatuses.map(status => {
              const statusVisual = statusVisualMap[status] || { 
                icon: Circle, 
                colorStyle: { color: 'rgb(var(--color-text-secondary))' } 
              };
              const StatusIcon = statusVisual.icon;
              return (
                <div 
                  key={status} 
                  className="flex items-center gap-1 sm:gap-1.5 md:gap-2 text-3xs sm:text-2xs md:text-xs"
                  style={{ color: 'rgb(var(--color-text))' }}
                >
                  <StatusIcon 
                    className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" 
                    style={statusVisual.colorStyle}
                  />
                  <span className="truncate">{status}</span>
        </div>
              );
            })}
        </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Calendar; 