# iola1999

[https://678234.xyz](https://678234.xyz)

Powered by [Jekyll](http://jekyllrb.com), themed from [Less](http://lesscss.cn), refactored by [Freud Kang](http://www.hifreud.com).

## develop

```bash
export SDKROOT=$(xcrun --show-sdk-path)
brew install ruby
ruby -v
echo 'export PATH="/usr/local/opt/ruby/bin:$PATH"' >> ~/.zshrc
echo 'export PATH="$HOME/.gem/ruby/3.0.0/bin:$PATH"' >> ~/.zshrc
gem install --user-install bundler jekyll
jekyll build
http-server _site
```

## Write with Typora

### Save image to relative directory

`../upload/images/${filename}`

