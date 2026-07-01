'use client'

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { DPFormData, defaultFormData, emptyFormData } from '@/lib/models'

interface DPContextType {
    formData: DPFormData
    isTestMode: boolean
    currentDossierId: string | null
    isLoadingDossier: boolean
    toggleTestMode: () => void
    loadDossier: (id: string) => Promise<void>
    setLastStep: (n: number) => void
    saveNow: () => void
    updateDemandeur: (data: Partial<DPFormData['demandeur']>) => void
    updateCoDemandeur: (data: Partial<NonNullable<DPFormData['co_demandeur']>>) => void
    updateTerrain: (data: Partial<DPFormData['terrain']>) => void
    updateTravaux: (data: Partial<DPFormData['travaux']>) => void
    updatePhotos: (data: Partial<DPFormData['photos']>) => void
    updatePlans: (data: Partial<DPFormData['plans']>) => void
    updateField: (field: keyof DPFormData, value: unknown) => void
    resetForm: () => void
}

const DPContext = createContext<DPContextType | undefined>(undefined)

const CACHE_PREFIX = 'dp-dossier-'      // per-dossier offline cache (dp-dossier-<id>)
const AUTOSAVE_MS = 1600

// Merge a stored/loaded dossier over emptyFormData so a field the user never filled stays blank
// (never inherits the dummy test-template values). Mirrors the historical hydrate invariant.
function hydrate(parsed: Partial<DPFormData>): DPFormData {
    const base = emptyFormData
    return {
        ...base,
        ...parsed,
        photos: { ...base.photos, ...parsed.photos },
        travaux: { ...base.travaux, ...parsed.travaux },
        demandeur: { ...base.demandeur, ...parsed.demandeur },
        terrain: { ...base.terrain, ...parsed.terrain },
    }
}

export function DPProvider({ children }: { children: ReactNode }) {
    const [formData, setFormData] = useState<DPFormData>(emptyFormData)
    const [isTestMode, setIsTestMode] = useState(false)
    const [currentDossierId, setCurrentDossierId] = useState<string | null>(null)
    const [isLoadingDossier, setIsLoadingDossier] = useState(false)

    // Refs mirror state for the debounced autosave (avoids stale closures).
    const formDataRef = useRef(formData)
    const dossierIdRef = useRef(currentDossierId)
    const testModeRef = useRef(isTestMode)
    const lastStepRef = useRef(1)
    const suppressSaveRef = useRef(false)   // set when hydrating, so a load doesn't re-PUT itself
    const inFlightRef = useRef(false)
    const dirtyRef = useRef(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => { formDataRef.current = formData }, [formData])
    useEffect(() => { dossierIdRef.current = currentDossierId }, [currentDossierId])
    useEffect(() => { testModeRef.current = isTestMode }, [isTestMode])

    // Discard the legacy single-dossier localStorage draft (pre-accounts); it holds base64
    // images tied to no user and is inert under the per-dossier cache.
    useEffect(() => {
        try {
            localStorage.removeItem('dp-travaux-form')
            localStorage.removeItem('dp-travaux-form-version')
            localStorage.removeItem('dp-travaux-form-testmode')
        } catch { /* ignore */ }
    }, [])

    const doSave = useCallback(async () => {
        const id = dossierIdRef.current
        if (!id || testModeRef.current) return
        if (inFlightRef.current) { dirtyRef.current = true; return }
        inFlightRef.current = true
        dirtyRef.current = false
        try {
            await fetch(`/api/dossiers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: formDataRef.current, lastStep: lastStepRef.current }),
            })
        } catch { /* offline cache below still holds it */ } finally {
            inFlightRef.current = false
            if (dirtyRef.current) doSave()
        }
    }, [])

    // Autosave (debounced) + per-dossier offline cache on every change.
    useEffect(() => {
        if (suppressSaveRef.current) { suppressSaveRef.current = false; return }
        const id = currentDossierId
        if (!id || isTestMode) return
        try { localStorage.setItem(`${CACHE_PREFIX}${id}`, JSON.stringify(formData)) } catch { /* quota */ }
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => { doSave() }, AUTOSAVE_MS)
        return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }, [formData, currentDossierId, isTestMode, doSave])

    // Flush a pending save when the tab is hidden/closed mid-edit.
    useEffect(() => {
        const flush = () => {
            const id = dossierIdRef.current
            if (!id || testModeRef.current) return
            try {
                navigator.sendBeacon?.(`/api/dossiers/${id}`, new Blob(
                    [JSON.stringify({ data: formDataRef.current, lastStep: lastStepRef.current })],
                    { type: 'application/json' },
                ))
            } catch { /* ignore */ }
        }
        window.addEventListener('visibilitychange', flush)
        window.addEventListener('pagehide', flush)
        return () => { window.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flush) }
    }, [])

    const loadDossier = useCallback(async (id: string) => {
        if (dossierIdRef.current === id && !isLoadingDossier) return  // already active
        setIsLoadingDossier(true)
        try {
            const res = await fetch(`/api/dossiers/${id}`)
            if (res.status === 401) { window.location.href = `/login?next=/etape/${id}/1`; return }
            if (res.ok) {
                const { dossier } = await res.json()
                suppressSaveRef.current = true
                setIsTestMode(false)
                lastStepRef.current = dossier.lastStep || 1
                setFormData(hydrate(dossier.data || {}))
                setCurrentDossierId(id)
            } else {
                // Fallback to the offline cache if the network/DB is unavailable.
                const cached = localStorage.getItem(`${CACHE_PREFIX}${id}`)
                if (cached) {
                    suppressSaveRef.current = true
                    setFormData(hydrate(JSON.parse(cached)))
                    setCurrentDossierId(id)
                }
            }
        } catch {
            const cached = localStorage.getItem(`${CACHE_PREFIX}${id}`)
            if (cached) { suppressSaveRef.current = true; setFormData(hydrate(JSON.parse(cached))); setCurrentDossierId(id) }
        } finally {
            setIsLoadingDossier(false)
        }
    }, [isLoadingDossier])

    const setLastStep = useCallback((n: number) => { lastStepRef.current = n }, [])
    const saveNow = useCallback(() => { if (timerRef.current) clearTimeout(timerRef.current); doSave() }, [doSave])

    // Test mode: client-only preview with the fixture. Detaches from any real dossier and never autosaves.
    const toggleTestMode = () => {
        const newMode = !isTestMode
        suppressSaveRef.current = true
        setIsTestMode(newMode)
        setCurrentDossierId(null)
        setFormData(newMode ? defaultFormData : emptyFormData)
    }

    const updateDemandeur = (data: Partial<DPFormData['demandeur']>) =>
        setFormData(prev => ({ ...prev, demandeur: { ...prev.demandeur, ...data } }))
    const updateCoDemandeur = (data: Partial<NonNullable<DPFormData['co_demandeur']>>) =>
        setFormData(prev => ({ ...prev, co_demandeur: { ...emptyFormData.co_demandeur!, ...prev.co_demandeur, ...data } }))
    const updateTerrain = (data: Partial<DPFormData['terrain']>) =>
        setFormData(prev => ({ ...prev, terrain: { ...prev.terrain, ...data } }))
    const updateTravaux = (data: Partial<DPFormData['travaux']>) =>
        setFormData(prev => ({ ...prev, travaux: { ...prev.travaux, ...data } }))
    const updatePhotos = (data: Partial<DPFormData['photos']>) =>
        setFormData(prev => ({ ...prev, photos: { ...prev.photos, ...data } }))
    const updatePlans = (data: Partial<DPFormData['plans']>) =>
        setFormData(prev => ({ ...prev, plans: { ...prev.plans, ...data } }))
    const updateField = (field: keyof DPFormData, value: unknown) =>
        setFormData(prev => ({ ...prev, [field]: value }))

    const resetForm = () => {
        suppressSaveRef.current = true
        setFormData(isTestMode ? defaultFormData : emptyFormData)
    }

    return (
        <DPContext.Provider value={{
            formData, isTestMode, currentDossierId, isLoadingDossier,
            toggleTestMode, loadDossier, setLastStep, saveNow,
            updateDemandeur, updateCoDemandeur, updateTerrain, updateTravaux,
            updatePhotos, updatePlans, updateField, resetForm,
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
