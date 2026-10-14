import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import { startApplication } from './observability/startApplication'

void startApplication(createRoot(document.getElementById('root')))
