const request = require('request-promise')

const mapboxToken = process.env.MAPBOX_TOKEN
const directionEndpoint = 'https://api.mapbox.com/directions/v5/mapbox/'
const staticMapEndpoint = 'https://api.mapbox.com/styles/v1/mapbox/streets-v10/static/'

const pointsToGeoJson = (points) => {
  // returns a promise
  let features = []
  if (Object.keys(points).length === 1 && points.from) {
    // this is the position set by the user
    const marker = getMarker(points.from)
    features = [marker]
  } else if (points.from && points.bike && points.slot && points.to) {
    // this is a full trip
    const fromMarker = getMarker(points.from)
    const bikeMarker = getMarker(points.bike, 'bicycle')
    const slotMarker = getMarker(points.slot, 'parking')
    const toMarker = getMarker(points.to, 'star')
    const p1 = getPath(points.from, points.bike, 'walking')
    const p2 = getPath(points.bike, points.slot, 'cycling')
    const p3 = getPath(points.slot, points.to, 'walking')
    features = [p1, p2, p3, fromMarker, bikeMarker, slotMarker, toMarker]
  } else if (points.from && points.bike) {
    // this is a bike search
    const fromMarker = getMarker(points.from)
    const bikeMarker = getMarker(points.bike, 'bicycle')
    const p = getPath(points.from, points.bike, 'walking')
    features = [fromMarker, bikeMarker, p]
  } else if (points.from && points.slot) {
    // this is a slot search
    const fromMarker = getMarker(points.from)
    const slotMarker = getMarker(points.slot, 'parking')
    const p = getPath(points.from, points.slot, 'cycling')
    features = [fromMarker, slotMarker, p]
  } else {
    console.log('unexpected points')
    console.log(points)
    return Promise.reject('unexpected points')
  }
  // features can be a mix of values and promises, resolve them
  return Promise.all(features).then(featuresResolved => {
    //console.log(featuresResolved)
    return { type: 'FeatureCollection', features: featuresResolved }
  })
}

const getPath = (s, d, mode) => {
  // TODO styling
  // TODO catch unauthorized return straight line
  const uri = directionEndpoint + `${mode}/${s.lng},${s.lat};${d.lng},${d.lat}`

  return request.get({ uri: uri, qs: { access_token: mapboxToken, geometries: 'geojson' }, json: true }).then(result => {
    // TODO extract the body and encapsulate in a feature
    //console.log(JSON.stringify(result))
    const color = (mode === 'cycling') ? '#b22600' : '#008743'
    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: result.routes[0].geometry.coordinates
      },
      properties: {'stroke': color, 'stroke-width': 5}
    }
  })
}

const getMarker = (position, type = 'marker') => {
  return {
    type: 'Feature',
    geometry: { 'type': 'Point', coordinates: [position.lng, position.lat] },
    properties: { 'marker-symbol': type, 'marker-color': '#116cff' }
  }
}

const pointsToMapUrl = (points) => {
  return pointsToGeoJson(points).then(geoJson => {
    let result = null
    if (points.length === 1) {
      // fix the zoom
      const loczoom = `${points[0].value.lng},${points[0].value.lat},13`
      result = staticMapEndpoint + `geojson(${escape(JSON.stringify(geoJson))})/${loczoom}/800x600@2x?access_token=${mapboxToken}`
    } else {
      // use auto zoom
      result = staticMapEndpoint + `geojson(${escape(JSON.stringify(geoJson))})/auto/800x600@2x?access_token=${mapboxToken}`
    }
    //console.log(result)
    return result
  })
}

module.exports = { pointsToMapUrl }
