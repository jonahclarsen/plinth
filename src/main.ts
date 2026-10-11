import { mount } from 'svelte'
import App from './App.svelte'
import MusicAccess from './lib/MusicAccess.svelte'
import './app.css'
const access = new URLSearchParams(location.search).has('access')
mount(access ? MusicAccess : App, { target: document.getElementById('app')! })
