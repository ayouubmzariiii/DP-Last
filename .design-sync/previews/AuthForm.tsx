import React from 'react'
import { AuthForm } from 'dp-travaux'

// The account auth screen — a centred card on the warm-paper background, with the
// Spectral serif heading, dp-* form controls, and the green accent primary button.
// `mode` switches copy/fields between signing in and creating an account.

export const Login = () => <AuthForm mode="login" />

export const Register = () => <AuthForm mode="register" />
