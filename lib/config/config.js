module.exports = {
    name: 'Gorkhapatra Notices',

    // use comma to separate multiple directories
    album_base_dirs: [process.env.IMAGE_DIR, process.env.DELETED_DIR],
    count_per_page: "50",
    port: process.env.PORT,
    image_dir: process.env.IMAGE_DIR,
    // If not set, will guess by the "Accept-Language" header field by default
    lang: 'en',

    // Only IP in this list is allowed to do some operation on the images such as delete images
    // or change image directory
    ip_white_list: [],

    // del => delete files directly, mv => move files to a specified temporary directory
    delete_mode: 'mv',

    // when delete mode is 'mv'
    tmp_dir: process.env.DELETED_DIR,

    // production, development
    env: process.env.APP_ENV,

    social_media_post_command: process.env.SOCIAL_MEDIA_POST_COMMAND

};
