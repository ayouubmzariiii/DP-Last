'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { DPFormData, defaultFormData, emptyFormData } from '@/lib/models'

interface DPContextType {
    formData: DPFormData
    isTestMode: boolean
    toggleTestMode: () => void
    updateDemandeur: (data: Partial<DPFormData['demandeur']>) => void
    updateTerrain: (data: Partial<DPFormData['terrain']>) => void
    updateTravaux: (data: Partial<DPFormData['travaux']>) => void
    updatePhotos: (data: Partial<DPFormData['photos']>) => void
    updatePlans: (data: Partial<DPFormData['plans']>) => void
    updateField: (field: keyof DPFormData, value: unknown) => void
    resetForm: () => void
}

const DPContext = createContext<DPContextType | undefined>(undefined)

const STORAGE_KEY = 'dp-travaux-form'
const STORAGE_VERSION = 'v9' // bump to force reset on default changes

export function DPProvider({ children }: { children: ReactNode }) {
    const [formData, setFormData] = useState<DPFormData>(emptyFormData)
    const [isTestMode, setIsTestMode] = useState(false)
    const [isMounted, setIsMounted] = useState(false)

    // Load from localStorage on mount
    useEffect(() => {
        setIsMounted(true)
        try {
            const versionKey = `${STORAGE_KEY}-version`
            const savedVersion = localStorage.getItem(versionKey)
            if (savedVersion !== STORAGE_VERSION) {
                // Force reset — new defaults available
                localStorage.removeItem(STORAGE_KEY)
                localStorage.removeItem(`${STORAGE_KEY}-testmode`)
                localStorage.setItem(versionKey, STORAGE_VERSION)
                setFormData(emptyFormData)
                return
            }

            const savedTestMode = localStorage.getItem(`${STORAGE_KEY}-testmode`)
            if (savedTestMode === 'true') {
                setIsTestMode(true)
            }

            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) {
                const parsed = JSON.parse(saved)
                // Use defaultFormData (which has our dummy data templates) as base if testMode is on, otherwise emptyFormData
                const baseData = savedTestMode === 'true' ? defaultFormData : emptyFormData
                setFormData({
                    ...baseData,
                    ...parsed,
                    photos: { ...baseData.photos, ...parsed.photos },
                    travaux: { ...baseData.travaux, ...parsed.travaux },
                    demandeur: { ...baseData.demandeur, ...parsed.demandeur },
                    terrain: { ...baseData.terrain, ...parsed.terrain },
                })
            } else {
                setFormData(savedTestMode === 'true' ? defaultFormData : emptyFormData)
            }
        } catch {
            // ignore
        }
    }, [])

    const toggleTestMode = () => {
        const newMode = !isTestMode
        setIsTestMode(newMode)
        const newData = newMode ? defaultFormData : emptyFormData
        setFormData(newData)
        try {
            localStorage.setItem(`${STORAGE_KEY}-testmode`, newMode ? 'true' : 'false')
            // Don't overwrite saved data if turning it off immediately, but since it's a hard toggle we reset state
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newData))
        } catch { }
    }

    // Save to localStorage whenever formData changes
    useEffect(() => {
        if (!isMounted) return
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(formData))
        } catch {
            // ignore
        }
    }, [formData, isMounted])

    const updateDemandeur = (data: Partial<DPFormData['demandeur']>) => {
        setFormData(prev => ({ ...prev, demandeur: { ...prev.demandeur, ...data } }))
    }

    const updateTerrain = (data: Partial<DPFormData['terrain']>) => {
        setFormData(prev => ({ ...prev, terrain: { ...prev.terrain, ...data } }))
    }

    const updateTravaux = (data: Partial<DPFormData['travaux']>) => {
        setFormData(prev => ({
            ...prev,
            travaux: { ...prev.travaux, ...data }
        }))
    }

    const updatePhotos = (data: Partial<DPFormData['photos']>) => {
        setFormData(prev => ({ ...prev, photos: { ...prev.photos, ...data } }))
    }

    const updatePlans = (data: Partial<DPFormData['plans']>) => {
        setFormData(prev => ({ ...prev, plans: { ...prev.plans, ...data } }))
    }

    const updateField = (field: keyof DPFormData, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const resetForm = () => {
        setFormData(isTestMode ? defaultFormData : emptyFormData)
        localStorage.removeItem(STORAGE_KEY)
    }

    return (
        <DPContext.Provider value={{
            formData,
            isTestMode,
            toggleTestMode,
            updateDemandeur,
            updateTerrain,
            updateTravaux,
            updatePhotos,
            updatePlans,
            updateField,
            resetForm,
        }}>
            {children}
        </DPContext.Provider>
    )
}

export function useDPContext() {
    const ctx = useContext(DPContext)
    if (!ctx) throw new Error('useDPContext must be used within DPProvider')
    return ctx
}
