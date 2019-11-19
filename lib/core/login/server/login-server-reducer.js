// 

import { combineReducers } from 'redux'








export const server = combineReducers({
  apiKey(state = '', action) {
    return action.type === 'INIT' ? action.payload.apiKey : state
  },

  uri(state = '', action) {
    return action.type === 'INIT' ? action.payload.authServer : state
  }
})
