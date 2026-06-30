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
                    className="dp-input pr-10"
                    style={isValid ? { borderColor: 'var(--ac)', boxShadow: '0 0 0 3px rgba(45,90,76,.10)' } : undefined}
                    placeholder={placeholder || "Saisissez l'adresse complète..."}
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => query.length >= 3 && setShowSuggestions(true)}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {loading && (
                        <div className="dp-spinner dp-spinner-sm"></div>
                    )}
                    {isValid && !loading && (
                        <svg className="w-5 h-5" style={{ color: 'var(--ac)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </div>
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div className="dp-menu animate-fadeIn">
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            className="dp-menu-item"
                            onClick={() => handleSelect(s)}
                        >
                            <div className="label">{s.label}</div>
                            <div className="meta">{s.context}</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
