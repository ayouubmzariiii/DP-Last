'use client'

import { useState, useEffect, useRef } from 'react'

interface AddressSuggestion {
    label: string
    name: string
    postcode: string
    city: string
    context: string
    score: number
    coords: { lat: number; lon: number }
}

interface AddressAutocompleteProps {
    placeholder?: string
    initialValue?: string
    onAddressSelected: (address: { adresse: string; code_postal: string; commune: string; coords: { lat: number; lon: number } }) => void
}

export default function AddressAutocomplete({ placeholder, initialValue = '', onAddressSelected }: AddressAutocompleteProps) {
    const [query, setQuery] = useState(initialValue)
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [loading, setLoading] = useState(false)
    const [isValid, setIsValid] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setQuery(initialValue)
        if (initialValue) setIsValid(true)
    }, [initialValue])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const searchAddress = async (q: string) => {
        if (q.length < 3) {
            setSuggestions([])
            return
        }

        setLoading(true)
        try {
            const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`)
            const data = await response.json()
            const results = data.features.map((f: any) => ({
                label: f.properties.label,
                name: f.properties.name,
                postcode: f.properties.postcode,
                city: f.properties.city,
                context: f.properties.context,
                score: f.properties.score,
                coords: {
                    lat: f.geometry.coordinates[1],
                    lon: f.geometry.coordinates[0]
                }
            }))
            setSuggestions(results)
            setShowSuggestions(true)
        } catch (error) {
            console.error('Error fetching addresses:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setQuery(val)
        setIsValid(false)
        searchAddress(val)
    }

    const handleSelect = (suggestion: AddressSuggestion) => {
        setQuery(suggestion.label)
        setSuggestions([])
        setShowSuggestions(false)
        setIsValid(true)
        onAddressSelected({
            adresse: suggestion.name,
            code_postal: suggestion.postcode,
            commune: suggestion.city,
            coords: suggestion.coords
        })
    }

    return (
        <div className="relative w-full" ref={containerRef}>
            <div className="relative">
                <input
                    type="text"
                    className={`dp-input pr-10 ${isValid ? 'border-green-500/50 focus:border-green-500' : ''}`}
                    placeholder={placeholder || "Saisissez l'adresse complète..."}
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => query.length >= 3 && setShowSuggestions(true)}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {loading && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    )}
                    {isValid && !loading && (
                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </div>
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fadeIn">
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-0"
                            onClick={() => handleSelect(s)}
                        >
                            <div className="text-sm font-medium text-white">{s.label}</div>
                            <div className="text-xs text-slate-400">{s.context}</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
