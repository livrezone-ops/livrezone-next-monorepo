# GIT

## Dépôt principal

Le dépôt Git principal n'est pas situé dans `/workspace`.

Toujours utiliser :

```bash
git -C /home/livrezone/docker-data/volumes/livrezone_html_data/_data
```

Ne jamais supposer que le répertoire courant correspond à la racine Git.

---

## Exemples

Status :

```bash
git -C /home/livrezone/docker-data/volumes/livrezone_html_data/_data status
```

Ajouter des fichiers :

```bash
git -C /home/livrezone/docker-data/volumes/livrezone_html_data/_data add <fichier>
```

Commit :

```bash
git -C /home/livrezone/docker-data/volumes/livrezone_html_data/_data commit -m "message"
```

Push :

```bash
git -C /home/livrezone/docker-data/volumes/livrezone_html_data/_data push
```

---

## Règles

- Toujours utiliser le dépôt ci-dessus.
- Toujours vérifier `git status` avant un commit.
- Produire des commits petits et ciblés.
- Une modification logique = un commit identifiable.
- Ne jamais inclure de fichiers temporaires ou de secrets.