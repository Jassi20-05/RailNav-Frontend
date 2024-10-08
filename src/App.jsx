import { useState } from 'react'
import Map from "./components/Map"
import MapBuilder from "./components/MapBuilder"
import './App.css'

function App() {

  return (
    <>
      <div className='h-full'>
        <MapBuilder></MapBuilder>
      </div>
    </>
  )
}

export default App
