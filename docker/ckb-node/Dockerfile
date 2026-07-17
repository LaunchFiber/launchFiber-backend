#docker/ckb-node/Dockerfile
FROM node:22-bookworm

RUN npm install -g @offckb/cli

RUN mkdir -p /ckb-data

ENV HOME=/ckb-data

EXPOSE 8114
EXPOSE 28114

CMD ["offckb", "node"]