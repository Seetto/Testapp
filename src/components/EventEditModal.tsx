'use client'

import { useState, useEffect } from 'react'
import PlacesAutocomplete from './PlacesAutocomplete'

interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  location?: string
  htmlLink: string
}

interface EventEditModalProps {
  event: CalendarEvent | null
  isOpen: boolean
  onClose: () => void
  onSave: (eventId: string, updatedEvent: Partial<CalendarEvent>) => Promise<void>
}

export default function EventEditModal({ event, isOpen, onClose, onSave }: EventEditModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    summary: '',
    description: '',
    location: '',
    startDateTime: '',
    endDateTime: '',
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    if (event) {
      // Helper function to format datetime for input field
      const formatDateTimeForInput = (dateTimeString: string) => {
        const date = new Date(dateTimeString)
        // Format as YYYY-MM-DDTHH:MM for datetime-local input
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${year}-${month}-${day}T${hours}:${minutes}`
      }

      // Helper function to format date for input field
      const formatDateForInput = (dateString: string) => {
        const date = new Date(dateString)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
      
      setFormData({
        summary: event.summary || '',
        description: event.description || '',
        location: event.location || '',
        startDateTime: event.start.dateTime ? formatDateTimeForInput(event.start.dateTime) : '',
        endDateTime: event.end.dateTime ? formatDateTimeForInput(event.end.dateTime) : '',
        startDate: event.start.date ? formatDateForInput(event.start.date) : (event.start.dateTime ? formatDateForInput(event.start.dateTime) : ''),
        endDate: event.end.date ? formatDateForInput(event.end.date) : (event.end.dateTime ? formatDateForInput(event.end.dateTime) : '')
      })
      setIsEditing(false)
    }
  }, [event])

  if (!isOpen || !event) return null

  const isAllDay = !event.start.dateTime

  const formatEventDate = (event: CalendarEvent) => {
    const startDate = event.start.dateTime || event.start.date
    const endDate = event.end.dateTime || event.end.date
    
    if (!startDate) return 'No date'
    
    const start = new Date(startDate)
    const end = new Date(endDate || startDate)
    
    const isAllDay = !event.start.dateTime
    
    if (isAllDay) {
      return start.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }
    
    const isSameDay = start.toDateString() === end.toDateString()
    
    if (isSameDay) {
      return `${start.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })} • ${start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })} - ${end.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}`
    }
    
    return `${start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })} ${start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })} - ${end.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })} ${end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })}`
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updatedEvent: Partial<CalendarEvent> = {
        summary: formData.summary,
        description: formData.description,
        location: formData.location,
        start: isAllDay 
          ? { date: formData.startDate }
          : { dateTime: new Date(formData.startDateTime).toISOString() },
        end: isAllDay 
          ? { date: formData.endDate }
          : { dateTime: new Date(formData.endDateTime).toISOString() }
      }

      await onSave(event.id, updatedEvent)
      setIsEditing(false)
    } catch (error) {
      console.error('Error saving event:', error)
      // You could add error handling here, like showing a toast notification
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    // Reset form data to original values
    if (event) {
      // Helper function to format datetime for input field
      const formatDateTimeForInput = (dateTimeString: string) => {
        const date = new Date(dateTimeString)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${year}-${month}-${day}T${hours}:${minutes}`
      }

      // Helper function to format date for input field
      const formatDateForInput = (dateString: string) => {
        const date = new Date(dateString)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }

      setFormData({
        summary: event.summary || '',
        description: event.description || '',
        location: event.location || '',
        startDateTime: event.start.dateTime ? formatDateTimeForInput(event.start.dateTime) : '',
        endDateTime: event.end.dateTime ? formatDateTimeForInput(event.end.dateTime) : '',
        startDate: event.start.date ? formatDateForInput(event.start.date) : (event.start.dateTime ? formatDateForInput(event.start.dateTime) : ''),
        endDate: event.end.date ? formatDateForInput(event.end.date) : (event.end.dateTime ? formatDateForInput(event.end.dateTime) : '')
      })
    }
    setIsEditing(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Event' : 'Event Details'}
          </h2>
          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Edit
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {isSaving && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Event Title
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Event title"
              />
            ) : (
              <p className="text-gray-900 dark:text-white font-medium">
                {event.summary || 'Untitled Event'}
              </p>
            )}
          </div>

          {/* Date and Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date & Time
            </label>
            {isEditing ? (
              <div className="space-y-3">
                {isAllDay ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Start Date & Time</label>
                      <input
                        type="datetime-local"
                        value={formData.startDateTime}
                        onChange={(e) => setFormData({ ...formData, startDateTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">End Date & Time</label>
                      <input
                        type="datetime-local"
                        value={formData.endDateTime}
                        onChange={(e) => setFormData({ ...formData, endDateTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">
                {formatEventDate(event)}
              </p>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Location
            </label>
            {isEditing ? (
              <PlacesAutocomplete
                value={formData.location}
                onChange={(value) => setFormData({ ...formData, location: value })}
                placeholder="Add location"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={isSaving}
              />
            ) : (
              <p className="text-gray-600 dark:text-gray-400">
                {event.location || 'No location specified'}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            {isEditing ? (
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Add description"
              />
            ) : (
              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {event.description || 'No description'}
              </p>
            )}
          </div>

          {/* Google Calendar Link */}
          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Google Calendar
              </label>
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span>Open in Google Calendar</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
