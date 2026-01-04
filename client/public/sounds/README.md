# Sons do Sistema KDS

Para melhor experiência, adicione arquivos de som MP3 nesta pasta:

- `novo-pedido.mp3` - 3 bips curtos quando chega pedido novo
- `etapa.mp3` - 1 bip quando etapa é concluída
- `pronta.mp3` - 2 bips longos quando pizza fica pronta
- `atraso.mp3` - Bip contínuo para alertar atraso

## Sons Genéricos (fallback)

O sistema usa o Web Audio API para gerar bips sintéticos caso os arquivos não existam.
