/* data fetching */
const fetch = require('node-fetch')
const querystring = require('querystring')

const params = object => {
  const args = {}
  let empty = true
  for (const key in object) {
    if (object[key]) {
      empty = false
      args[key] = object[key]
    }
  }
  return empty ? '' : '?' + querystring.stringify(args)
}

const API = 'http://localhost:4567'
const fetchJson = path => fetch(`${API}${path}`).then(r => r.json())

// const fetchUser = id => fetchJson(`/users/${id}`)
const fetchUsers = ids => fetchJson(`/users${params({ids})}`)
const fetchUserComments = id => fetchJson(`/users/${id}/comments`)
const fetchUserPosts = id => fetchJson(`/users/${id}/posts`)

// const fetchPost = id => fetchJson(`/posts/${id}`)
const fetchPosts = ids => fetchJson(`/posts${params({ids})}`)
const fetchPostComments = id => fetchJson(`/posts/${id}/comments`)

/* data loader */
const DataLoader = require('dataloader')

const makeLoaders = () => {
  const userLoader = new DataLoader(fetchUsers)
  const postLoader = new DataLoader(fetchPosts)
  const userPostsLoader = new DataLoader(keys => Promise.all(keys.map(fetchUserPosts)))
  const userCommentsLoader = new DataLoader(keys => Promise.all(keys.map(fetchUserComments)))
  const postCommentsLoader = new DataLoader(keys => Promise.all(keys.map(fetchPostComments)))

  const fetchAll = (fetchMethod, loader) => async () => {
    const list = await fetchMethod()
    list.forEach(object => loader.prime(object.id, object))
    return list
  }

  return {
    userLoader,
    postLoader,
    userPostsLoader,
    userCommentsLoader,
    postCommentsLoader,
    fetchAllUsers: fetchAll(fetchUsers, userLoader),
    fetchAllPosts: fetchAll(fetchPosts, postLoader)
  }
}

/* resolvers */
const { GraphQLDateTime } = require('graphql-iso-date')

const resolvers = {
  DateTime: GraphQLDateTime,
  Query: {
    user (obj, args, {userLoader}) {
      return userLoader.load(args.id)
    },
    users (obj, args, {userLoader, fetchAllUsers}) {
      return args.ids ? userLoader.loadMany(args.ids) : fetchAllUsers()
    },
    post (obj, args, {postLoader}) {
      return postLoader.load(args.id)
    },
    posts (obj, args, {postLoader, fetchAllPosts}) {
      return args.ids ? postLoader.loadMany(args.ids) : fetchAllPosts()
    }
  },
  User: {
    posts (obj, args, {userPostsLoader}) {
      return userPostsLoader.load(obj.id)
    },
    comments (obj, args, {userCommentsLoader}) {
      return userCommentsLoader.load(obj.id)
    }
  },
  Post: {
    comments (obj, args, {postCommentsLoader}) {
      return postCommentsLoader.load(obj.id)
    },
    author (obj, args, {userLoader}) {
      return userLoader.load(obj.authorId)
    }
  },
  Comment: {
    author (obj, args, {userLoader}) {
      return userLoader.load(obj.authorId)
    },
    post (obj, args, {postLoader}) {
      return postLoader.load(obj.postId)
    }
  }
}

/* schema */
const fs = require('fs')
const path = require('path')
const { makeExecutableSchema } = require('graphql-tools')

const typeDefs = fs.readFileSync(path.join(__dirname, 'schema.graphql'), { encoding: 'utf-8' })

const schema = makeExecutableSchema({
  typeDefs,
  resolvers
})

/* express app */
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const { graphqlExpress } = require('graphql-server-express')

const app = express()
app.use('/', cors(), bodyParser.json({type: '*/*'}), graphqlExpress(
  () => ({
    schema,
    context: makeLoaders()
  })
))
app.listen(5678)
