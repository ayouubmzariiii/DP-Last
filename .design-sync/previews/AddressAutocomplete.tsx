import React from 'react'
import { AddressAutocomplete } from 'dp-travaux'

// Address field with live suggestions (French BAN geocoder). Emits a structured
// address via onAddressSelected. Shown empty (with a prompt) and pre-filled.

export const Default = () => (
    <div style={{ maxWidth: 440 }}>
        <label className="dp-label">Adresse du terrain</label>
        <AddressAutocomplete placeholder="Saisissez l'adresse du terrain…" onAddressSelected={() => {}} />
    </div>
)

export const Prefilled = () => (
    <div style={{ maxWidth: 440 }}>
        <label className="dp-label">Adresse du terrain</label>
        <AddressAutocomplete initialValue="3 Rue Victor Hugo, 38200 Vienne" onAddressSelected={() => {}} />
    </div>
)
