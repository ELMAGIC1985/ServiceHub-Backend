import ImageKit from 'imagekit'

var imagekit = new ImageKit({
    publicKey: 'public_jhDAL56uT7gIYPzKxlp0hjm6ySw=',
    privateKey: 'private_hBdodWdc7QD+hK3Spov6Wsc1nRU=',
    urlEndpoint: 'https://ik.imagekit.io/tdqyyqklv'
})

export const imageKitAuthenticate = (req, res) => {
    console.log('Imagekit authentication endpoint hit')
    const result = imagekit.getAuthenticationParameters()
    console.log('Imagekit authentication result', result)
    res.send(result)
}
