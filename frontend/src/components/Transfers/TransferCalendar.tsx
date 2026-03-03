import React, { useMemo } from 'react';
import { Calendar, dateFnsLocalizer, View, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Transfer } from '../../types';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { ru };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

interface Props {
  transfers: Transfer[];
  onSelect: (transfer: Transfer) => void;
  onNew: (date: Date) => void;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: '#3b82f6',
  COMPLETED: '#22c55e',
  CANCELLED: '#ef4444',
};

export default function TransferCalendar({ transfers, onSelect, onNew }: Props) {
  const events = useMemo(() =>
    transfers.map((t) => ({
      id: t.id,
      title: `${t.origin} → ${t.destination} (${t.driver?.fullName})`,
      start: new Date(t.startTime),
      end: new Date(t.endTime),
      resource: t,
      color: STATUS_COLORS[t.status] || '#6b7280',
    })),
    [transfers]
  );

  const eventStyleGetter = (event: any) => ({
    style: {
      backgroundColor: event.color,
      borderColor: event.color,
      color: 'white',
      borderRadius: '4px',
      fontSize: '12px',
    },
  });

  const messages = {
    allDay: 'Весь день',
    previous: '‹',
    next: '›',
    today: 'Сегодня',
    month: 'Месяц',
    week: 'Неделя',
    day: 'День',
    agenda: 'Список',
    date: 'Дата',
    time: 'Время',
    event: 'Событие',
    noEventsInRange: 'Нет трансферов в этом периоде',
  };

  return (
    <div className="card" style={{ height: 640 }}>
      <Calendar
        localizer={localizer}
        events={events}
        defaultView={Views.WEEK}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        style={{ height: 600 }}
        eventPropGetter={eventStyleGetter}
        messages={messages}
        onSelectEvent={(event: any) => onSelect(event.resource)}
        onSelectSlot={(slotInfo: any) => onNew(slotInfo.start)}
        selectable
        culture="ru"
      />
    </div>
  );
}
