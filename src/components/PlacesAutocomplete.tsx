'use client'

import { useState, useRef, useEffect } from 'react'

interface PlacesAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

interface PlacePrediction {
  place_id: string
  description: string
  structured_formatting: {
    main_text: string
    secondary_text: string
  }
}

export default function PlacesAutocomplete({ 
  value, 
  onChange, 
  placeholder = "Enter location", 
  className = "",
  disabled = false
}: PlacesAutocompleteProps) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [showPredictions, setShowPredictions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize Google Places service
  const initializePlacesService = () => {
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      return new window.google.maps.places.AutocompleteService()
    }
    return null
  }

  const searchPlaces = async (input: string) => {
    const service = initializePlacesService()
    if (!service || input.length < 3) {
      setPredictions([])
      return
    }

    setIsLoading(true)

    const request = {
      input,
      types: ['establishment', 'geocode'],
      componentRestrictions: { country: 'au' } // Restrict to Australia based on your example
    }

    service.getPlacePredictions(request, (predictions, status) => {
      setIsLoading(false)
      
      if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
        setPredictions(predictions.slice(0, 5)) // Limit to 5 suggestions
      } else {
        setPredictions([])
      }
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    // Debounce the search
    debounceTimeoutRef.current = setTimeout(() => {
      if (newValue.trim()) {
        searchPlaces(newValue)
        setShowPredictions(true)
      } else {
        setPredictions([])
        setShowPredictions(false)
      }
    }, 300)
  }

  const handlePredictionClick = (prediction: PlacePrediction) => {
    onChange(prediction.description)
    setPredictions([])
    setShowPredictions(false)
    inputRef.current?.blur()
  }

  const handleFocus = () => {
    if (predictions.length > 0) {
      setShowPredictions(true)
    }
  }

  const handleBlur = () => {
    // Delay hiding to allow click on predictions
    setTimeout(() => {
      setShowPredictions(false)
    }, 200)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  // Load Google Maps API if not already loaded
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.google) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }, [])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
      
      {showPredictions && predictions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {predictions.map((prediction) => (
            <button
              key={prediction.place_id}
              type="button"
              onClick={() => handlePredictionClick(prediction)}
              className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 last:border-b-0"
            >
              <div className="text-sm">
                <div className="font-medium text-gray-900 dark:text-white">
                  {prediction.structured_formatting.main_text}
                </div>
                <div className="text-gray-500 dark:text-gray-400 text-xs">
                  {prediction.structured_formatting.secondary_text}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  )
}

// Extend the Window interface for TypeScript
declare global {
  interface Window {
    google: {
      maps: {
        places: {
          AutocompleteService: new () => {
            getPlacePredictions: (
              request: {
                input: string
                types?: string[]
                componentRestrictions?: { country: string }
              },
              callback: (
                predictions: PlacePrediction[] | null,
                status: string
              ) => void
            ) => void
          }
          PlacesServiceStatus: {
            OK: string
          }
        }
      }
    }
  }
}
