import { Appointment, GoogleCalendarItem, HealthCalendar } from '../types';

// List all calendars of the user to see if "Agenda de Saúde" already exists or if we should use primary
export const listCalendars = async (token: string): Promise<HealthCalendar[]> => {
  if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
    console.warn('listCalendars called with invalid token');
    return [];
  }
  try {
    const res = await fetch(`/api/calendar-proxy/users/me/calendarList?_=${Date.now()}`, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      const errorObj = new Error(`Failed to list calendars: ${res.statusText} (${res.status}) - ${errBody}`);
      (errorObj as any).status = res.status;
      throw errorObj;
    }
    const data = await res.json();
    const calendars = (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary,
      description: item.description,
      primary: item.primary || false,
      timeZone: item.timeZone,
    }));
    try {
      localStorage.setItem('cached_calendar_list', JSON.stringify(calendars));
    } catch (e) {
      console.warn('Failed to cache calendar list:', e);
    }
    return calendars;
  } catch (error: any) {
    const isAuthError = 
      error?.status === 401 || 
      error?.status === 403 || 
      String(error?.message || '').includes('401') || 
      String(error?.message || '').includes('403') ||
      String(error || '').includes('401') || 
      String(error || '').includes('403');

    if (isAuthError) {
      console.warn('Google Calendar Authentication expired or invalid (401) during calendar list.', error?.message || error);
      throw error;
    } else {
      console.warn('Error listing calendars, attempting cached fallback:', error);
      try {
        const cached = localStorage.getItem('cached_calendar_list');
        if (cached) {
          console.log('[GoogleCalendar] Utilizing cached calendar list.');
          return JSON.parse(cached);
        }
      } catch (cacheErr) {
        console.warn('Failed to read cached calendar list:', cacheErr);
      }

      // If no cache exists, return a local fallback so the app continues to operate.
      return [{
        id: 'primary',
        summary: 'Agenda Principal (Local)',
        description: 'Calendário de fallback local devido a erro de conexão.',
        primary: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }];
    }
  }
};

// Create a dedicated "Agenda de Saúde" calendar
export const createHealthCalendar = async (token: string, timeZone?: string): Promise<HealthCalendar> => {
  if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
    console.warn('createHealthCalendar called with invalid token');
    throw new Error('Invalid token for creating health calendar');
  }
  try {
    const activeTimeZone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch('/api/calendar-proxy/calendars', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: 'Agenda de Saúde',
        description: 'Compromissos de saúde, consultas e exames sincronizados por meu aplicativo.',
        timeZone: activeTimeZone,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Failed to create health calendar: ${res.statusText} (${res.status}) - ${errBody}`);
    }

    const data = await res.json();
    return {
      id: data.id,
      summary: data.summary,
      description: data.description,
      primary: false,
    };
  } catch (error) {
    console.error('Error creating health calendar:', error);
    throw error;
  }
};

// Map Appointment category to a color code
export const getSpecialtyColor = (specialty: string): string => {
  const spec = specialty.toLowerCase();
  if (spec.includes('cardio')) return 'emerald';
  if (spec.includes('geral') || spec.includes('clínic')) return 'teal';
  if (spec.includes('dent') || spec.includes('odonto')) return 'blue';
  if (spec.includes('derma')) return 'purple';
  if (spec.includes('ginec') || spec.includes('obstetr')) return 'rose';
  if (spec.includes('orto') || spec.includes('fisiot')) return 'amber';
  if (spec.includes('exame') || spec.includes('sangue') || spec.includes('lab')) return 'sky';
  if (spec.includes('pediatr')) return 'pink';
  if (spec.includes('oftalmo') || spec.includes('olho')) return 'cyan';
  if (spec.includes('psic') || spec.includes('terapia')) return 'indigo';
  return 'slate';
};

// Serialize custom fields into Google Calendar description
const buildEventDescription = (app: Omit<Appointment, 'id'>): string => {
  return [
    `Tipo: ${app.type}`,
    `Especialidade: ${app.specialty}`,
    `Médico(a): ${app.doctorName || 'Não especificado'}`,
    `Clínica/Local: ${app.clinicName || 'Não especificado'}`,
    `Status: ${app.status === 'scheduled' ? 'Agendado' : app.status === 'completed' ? 'Realizado' : 'Cancelado'}`,
    `---`,
    `Observações: ${app.notes || 'Nenhuma observação informada.'}`
  ].join('\n');
};

// Parse Google Calendar description to extract custom fields
const parseEventDescription = (description: string = '', summary: string = '', location: string = '') => {
  const lines = description.split('\n');
  let type: 'consulta' | 'exame' | 'retorno' | 'outros' = 'consulta';
  let specialty = 'Clínico Geral';
  let doctorName = '';
  let clinicName = location || '';
  let status: 'scheduled' | 'completed' | 'canceled' = 'scheduled';
  let notes = '';

  let hasStructuredData = false;
  let parsedNotesLines: string[] = [];
  let isAfterSeparator = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '---') {
      isAfterSeparator = true;
      continue;
    }

    if (isAfterSeparator) {
      parsedNotesLines.push(line);
      continue;
    }

    if (trimmed.startsWith('Tipo:')) {
      hasStructuredData = true;
      const val = trimmed.replace('Tipo:', '').trim().toLowerCase();
      if (val === 'exame') type = 'exame';
      else if (val === 'retorno') type = 'retorno';
      else if (val === 'outros') type = 'outros';
      else type = 'consulta';
    } else if (trimmed.startsWith('Especialidade:')) {
      hasStructuredData = true;
      specialty = trimmed.replace('Especialidade:', '').trim();
    } else if (trimmed.startsWith('Médico(a):')) {
      hasStructuredData = true;
      doctorName = trimmed.replace('Médico(a):', '').trim();
    } else if (trimmed.startsWith('Clínica/Local:')) {
      hasStructuredData = true;
      clinicName = trimmed.replace('Clínica/Local:', '').trim();
    } else if (trimmed.startsWith('Status:')) {
      hasStructuredData = true;
      const val = trimmed.replace('Status:', '').trim().toLowerCase();
      if (val === 'realizado') status = 'completed';
      else if (val === 'cancelado') status = 'canceled';
      else status = 'scheduled';
    }
  }

  if (isAfterSeparator) {
    notes = parsedNotesLines.join('\n').replace('Observações:', '').trim();
  }

  // Fallback parsing if the event was created manually on Google Calendar without app structure
  if (!hasStructuredData) {
    const lowerSummary = summary.toLowerCase();
    if (lowerSummary.includes('exame') || lowerSummary.includes('sangue') || lowerSummary.includes('laborat')) {
      type = 'exame';
      specialty = 'Exame Laboratorial';
    } else if (lowerSummary.includes('retorno')) {
      type = 'retorno';
    } else if (lowerSummary.includes('dentista') || lowerSummary.includes('odonto')) {
      specialty = 'Dentista';
    } else if (lowerSummary.includes('cardio')) {
      specialty = 'Cardiologia';
    } else if (lowerSummary.includes('derma')) {
      specialty = 'Dermatologia';
    } else if (lowerSummary.includes('ginec')) {
      specialty = 'Ginecologia';
    } else if (lowerSummary.includes('ortop')) {
      specialty = 'Ortopedia';
    } else if (lowerSummary.includes('oftal') || lowerSummary.includes('olho')) {
      specialty = 'Oftalmologia';
    }

    // Try to extract doctor name (e.g., "Dr. Silva" or "Dra. Ana")
    const docMatch = summary.match(/(Dr\.|Dra\.)\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)/i);
    if (docMatch) {
      doctorName = docMatch[0];
    }

    notes = description;
  }

  return { type, specialty, doctorName, clinicName, status, notes };
};

// Helper to safely format/extract date & time parts in a specific timezone
export const getPartsInTimeZone = (isoString: string, timeZone: string) => {
  try {
    const dateObj = new Date(isoString);
    if (isNaN(dateObj.getTime())) {
      return null;
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(dateObj);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const hour = getPart('hour');
    const minute = getPart('minute');

    if (year && month && day && hour && minute) {
      return {
        year,
        month,
        day,
        hour,
        minute,
        dateStr: `${year}-${month}-${day}`,
        timeStr: `${hour}:${minute}`,
      };
    }
  } catch (err) {
    console.warn('Error formatting with formatToParts for timezone:', timeZone, err);
  }
  return null;
};

// Convert Google Calendar Item to App Appointment
export const mapGoogleEventToAppointment = (item: GoogleCalendarItem, timeZone?: string): Appointment => {
  const startDateTime = (item.start || {}).dateTime || (item.start || {}).date || '';
  const endDateTime = (item.end || {}).dateTime || (item.end || {}).date || '';
  const activeTimeZone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Extract date (YYYY-MM-DD) and times (HH:MM)
  let date = '';
  let startTime = '09:00';
  let endTime = '10:00';

  if (startDateTime) {
    if (startDateTime.includes('T')) {
      const parts = getPartsInTimeZone(startDateTime, activeTimeZone);
      if (parts) {
        date = parts.dateStr;
        startTime = parts.timeStr;
      } else {
        // Safe string-split fallback
        date = startDateTime.split('T')[0] || '';
        startTime = startDateTime.split('T')[1].substring(0, 5);
      }
    } else {
      date = startDateTime;
      startTime = '00:00';
    }
  }

  if (endDateTime) {
    if (endDateTime.includes('T')) {
      const parts = getPartsInTimeZone(endDateTime, activeTimeZone);
      if (parts) {
        endTime = parts.timeStr;
      } else {
        // Safe string-split fallback
        endTime = endDateTime.split('T')[1].substring(0, 5);
      }
    } else {
      endTime = '23:59';
    }
  }

  // Clean the summary (remove our 🩺 icon if present)
  let title = item.summary || 'Consulta de Saúde';
  if (title.startsWith('🩺 [Saúde] ')) {
    title = title.replace('🩺 [Saúde] ', '');
  } else if (title.startsWith('[Saúde] ')) {
    title = title.replace('[Saúde] ', '');
  }

  const parsedFields = parseEventDescription(item.description, item.summary, item.location);
  const isAllDay = !!(item.start.date && !item.start.dateTime);

  return {
    id: item.id,
    title,
    type: parsedFields.type,
    specialty: parsedFields.specialty,
    doctorName: parsedFields.doctorName,
    clinicName: parsedFields.clinicName,
    date,
    startTime: isAllDay ? '' : startTime,
    endTime: isAllDay ? '' : endTime,
    notes: parsedFields.notes,
    status: parsedFields.status,
    googleEventId: item.id,
    color: getSpecialtyColor(parsedFields.specialty),
    allDay: isAllDay,
  };
};

// Fetch all events from selected calendar and parse them
export const fetchAppointments = async (token: string, calendarId: string, timeZone?: string): Promise<Appointment[]> => {
  if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
    console.warn('fetchAppointments called with invalid token');
    return [];
  }
  if (!calendarId || calendarId === 'undefined' || calendarId === 'null') {
    console.warn('fetchAppointments called with invalid calendarId:', calendarId);
    return [];
  }

  let url = '';
  try {
    // Fetch events from today - 6 months to today + 1 year
    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 6);
    
    url = `/api/calendar-proxy/calendars/${encodeURIComponent(calendarId)}/events?singleEvents=true&orderBy=startTime&timeMin=${timeMin.toISOString()}&maxResults=250&_=${Date.now()}`;
    
    const res = await fetch(url, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      const errorObj = new Error(`Failed to fetch events from Google Calendar: ${res.statusText} (${res.status}) - ${errBody}`);
      (errorObj as any).status = res.status;
      throw errorObj;
    }

    const data = await res.json();
    const items: GoogleCalendarItem[] = data.items || [];

    // Filter events to ensure they belong to our health app, if it is the primary calendar
    // (if it is a dedicated "Agenda de Saúde" calendar, we show all events)
    const isPrimary = calendarId === 'primary' || !calendarId.includes('group.calendar.google.com');
    
    let filteredItems = items;
    if (isPrimary) {
      filteredItems = items.filter((item) => {
        if (!item) return false;
        const title = item.summary || '';
        const desc = item.description || '';
        const hasHealthTag = title.includes('[Saúde]') || title.includes('🩺') || desc.includes('Especialidade:') || desc.includes('Tipo:');
        
        // Also support generic health terms in manual events
        const lowerTitle = title.toLowerCase();
        const hasKeywords = lowerTitle.includes('consulta') || 
                            lowerTitle.includes('exame') || 
                            lowerTitle.includes('médico') || 
                            lowerTitle.includes('médica') || 
                            lowerTitle.includes('dentista') || 
                            lowerTitle.includes('pediatra') || 
                            lowerTitle.includes('oftalmo') ||
                            lowerTitle.includes('retorno clínico');
                            
        return hasHealthTag || hasKeywords;
      });
    } else {
      filteredItems = items.filter(item => !!item);
    }

    const mapped = filteredItems.map((item) => mapGoogleEventToAppointment(item, timeZone));
    try {
      localStorage.setItem(`cached_appointments_${calendarId}`, JSON.stringify(mapped));
    } catch (e) {
      console.warn('Could not save appointments cache:', e);
    }
    return mapped;
  } catch (error: any) {
    const errStr = String(error?.message || error || '').toLowerCase();
    const isAuthError = error?.status === 401 || error?.status === 403 || errStr.includes('401') || errStr.includes('403') || errStr.includes('unauthorized') || errStr.includes('forbidden');
    
    if (isAuthError) {
      console.warn('Google Calendar Authentication/Permission error during fetchAppointments.', error?.message || error);
      throw error;
    } else {
      console.log('[GoogleCalendar] Cache fallback triggered due to retrieve issue:', {
        msg: error && typeof error === 'object' ? (error as any).message : String(error),
        code: error && typeof error === 'object' ? (error as any).status : undefined,
        calId: calendarId,
        endpoint: url
      });
      
      // Tentar cache local primeiro em caso de qualquer erro não-auth
      try {
        const cached = localStorage.getItem(`cached_appointments_${calendarId}`);
        if (cached) {
          console.log('Utilizando agendamentos armazenados em cache local devido a falha na rede ou erro do servidor.');
          return JSON.parse(cached);
        }
      } catch (e) {
        console.warn('Could not read appointments cache:', e);
      }

      // Se for um erro de rede genérico, retorna vazio para não quebrar a UI
      if (errStr.includes('failed to fetch') || errStr.includes('networkerror') || errStr.includes('network error')) {
        return [];
      }
      
      // Se chegamos aqui, é um erro de servidor (como 500 do proxy) ou erro de parse
      return [];
    }
  }
};

// Helper to safely format local date and times for Google Calendar events, ensuring the start and end range is always valid
export const getSafeDateTimes = (date: string, startTime: string, endTime: string): { startDateTime: string; endDateTime: string } => {
  let startStr = startTime || '09:00';
  let endStr = endTime || '10:00';

  if (!startStr.includes(':')) startStr = '09:00';
  if (!endStr.includes(':')) endStr = '10:00';

  // Parse hours and minutes
  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);

  let adjustedEndH = endH;
  let adjustedEndM = endM;

  // If start is after or equal to end, force end to be start + 1 hour
  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM) || startH > endH || (startH === endH && startM >= endM)) {
    adjustedEndH = (isNaN(startH) ? 9 : startH + 1) % 24;
    adjustedEndM = isNaN(startM) ? 0 : startM;
  }

  const paddedEndH = String(adjustedEndH).padStart(2, '0');
  const paddedEndM = String(adjustedEndM).padStart(2, '0');
  const correctedEndStr = `${paddedEndH}:${paddedEndM}`;

  let endDate = date || new Date().toISOString().split('T')[0];
  if (adjustedEndH < startH || (adjustedEndH === startH && adjustedEndM < startM)) {
    try {
      const d = new Date(`${endDate}T12:00:00`);
      d.setDate(d.getDate() + 1);
      endDate = d.toISOString().split('T')[0];
    } catch (err) {
      console.warn('Error incrementing end date:', err);
    }
  }

  const startDateTime = `${date}T${startStr}:00`;
  const endDateTime = `${endDate}T${correctedEndStr}:00`;

  return { startDateTime, endDateTime };
};

export const getNextDayStr = (dateStr: string): string => {
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  } catch (err) {
    return dateStr;
  }
};

// Create a new event on Google Calendar
export const createAppointment = async (
  token: string,
  calendarId: string,
  appointment: Omit<Appointment, 'id'>,
  timeZone?: string
): Promise<Appointment> => {
  try {
    const summary = `🩺 [Saúde] ${appointment.title}`;
    const description = buildEventDescription(appointment);

    const body: any = {
      summary,
      description,
      location: appointment.clinicName || '',
    };

    if (appointment.allDay) {
      body.start = {
        date: appointment.date,
      };
      body.end = {
        date: getNextDayStr(appointment.date),
      };
    } else {
      const { startDateTime, endDateTime } = getSafeDateTimes(appointment.date, appointment.startTime || '09:00', appointment.endTime || '10:00');
      body.start = {
        dateTime: startDateTime,
        timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      body.end = {
        dateTime: endDateTime,
        timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }

    const res = await fetch(`/api/calendar-proxy/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      const errorObj = new Error(`Failed to create Google Calendar event: ${res.statusText} (${res.status}) - ${errBody}`);
      (errorObj as any).status = res.status;
      throw errorObj;
    }

    const data: GoogleCalendarItem = await res.json();
    return mapGoogleEventToAppointment(data, timeZone);
  } catch (error: any) {
    const isAuthError = error?.status === 401 || String(error?.message || '').includes('401');
    if (isAuthError) {
      console.warn('Google Calendar Authentication expired or invalid (401) during event creation.', error?.message || error);
    } else {
      console.error('Error creating appointment:', error);
    }
    throw error;
  }
};

// Update an existing event on Google Calendar
export const updateAppointment = async (
  token: string,
  calendarId: string,
  eventId: string,
  appointment: Omit<Appointment, 'id'>,
  timeZone?: string
): Promise<Appointment> => {
  try {
    const summary = `🩺 [Saúde] ${appointment.title}`;
    const description = buildEventDescription(appointment);

    const body: any = {
      summary,
      description,
      location: appointment.clinicName || '',
    };

    if (appointment.allDay) {
      body.start = {
        date: appointment.date,
      };
      body.end = {
        date: getNextDayStr(appointment.date),
      };
    } else {
      const { startDateTime, endDateTime } = getSafeDateTimes(appointment.date, appointment.startTime || '09:00', appointment.endTime || '10:00');
      body.start = {
        dateTime: startDateTime,
        timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      body.end = {
        dateTime: endDateTime,
        timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }

    const res = await fetch(`/api/calendar-proxy/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      const errorObj = new Error(`Failed to update Google Calendar event: ${res.statusText} (${res.status}) - ${errBody}`);
      (errorObj as any).status = res.status;
      throw errorObj;
    }

    const data: GoogleCalendarItem = await res.json();
    return mapGoogleEventToAppointment(data, timeZone);
  } catch (error: any) {
    const isAuthError = error?.status === 401 || String(error?.message || '').includes('401');
    if (isAuthError) {
      console.warn('Google Calendar Authentication expired or invalid (401) during event update.', error?.message || error);
    } else {
      console.error('Error updating appointment:', error);
    }
    throw error;
  }
};

// Delete an event on Google Calendar
export const deleteAppointment = async (token: string, calendarId: string, eventId: string): Promise<void> => {
  try {
    const res = await fetch(`/api/calendar-proxy/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 410 || res.status === 404) {
        // If already deleted (410) or not found (404), treat as success
        return;
      }
      const errBody = await res.text().catch(() => '');
      const errorObj = new Error(`Failed to delete Google Calendar event: ${res.statusText} (${res.status}) - ${errBody}`);
      (errorObj as any).status = res.status;
      throw errorObj;
    }
  } catch (error: any) {
    const isAuthError = error?.status === 401 || String(error?.message || '').includes('401');
    if (isAuthError) {
      console.warn('Google Calendar Authentication expired or invalid (401) during event deletion.', error?.message || error);
    } else {
      console.error('Error deleting appointment:', error);
    }
    throw error;
  }
};

// Get the actual timezone of a calendar or from the settings of the user
export const getCalendarTimezone = async (token: string, calendarId: string = 'primary'): Promise<string> => {
  try {
    const res = await fetch(`/api/calendar-proxy/calendars/${encodeURIComponent(calendarId)}?_=${Date.now()}`, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });
    if (!res.ok) {
      if (res.status === 401) {
        const errorObj = new Error(`Failed to get calendar timezone: Unauthorized (401)`);
        (errorObj as any).status = 401;
        throw errorObj;
      }
      // fallback to user's settings timezone if specific calendar call fails
      const settingsRes = await fetch(`/api/calendar-proxy/users/me/settings/timezone?_=${Date.now()}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
      });
      if (!settingsRes.ok) {
        if (settingsRes.status === 401) {
          const errorObj = new Error(`Failed to get settings timezone: Unauthorized (401)`);
          (errorObj as any).status = 401;
          throw errorObj;
        }
        throw new Error(`Failed to get calendar or settings timezone: ${settingsRes.statusText} (${settingsRes.status})`);
      }
      const settingsData = await settingsRes.json();
      return settingsData.value || Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    const data = await res.json();
    return data.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error: any) {
    const errStr = String(error?.message || error || '').toLowerCase();
    const isAuthError = error?.status === 401 ||
      errStr.includes('401') || 
      errStr.includes('unauthorized') || 
      errStr.includes('invalid credentials') || 
      errStr.includes('unauthenticated');
      
    if (isAuthError) {
      console.warn('Google Calendar Authentication expired or invalid (401) during timezone fetch.', error?.message || error);
      throw error;
    }
    console.warn('Error fetching calendar timezone, falling back to local browser timezone:', error);
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
};

