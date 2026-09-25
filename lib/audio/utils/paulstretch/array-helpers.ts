export const add = function(array1, array2) {
  var i, length = array1.length
  for (i = 0; i < length; i++)
    array1[i] += array2[i]
  return array1
}

export const map = function(array, func) {
  var i, length
  for (i = 0, length = array.length; i < length; i++) array[i] = func(array[i])
  return array
}

export const duplicate = function(array) {
  return copy(array, new Float32Array(array.length))
}

export const copy = function(array1, array2) {
  var i, length
  for (i = 0, length = array1.length; i < length; i++) array2[i] = array1[i]
  return array2
}