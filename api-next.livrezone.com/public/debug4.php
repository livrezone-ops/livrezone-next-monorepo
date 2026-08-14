<?php
 = curl_init();
curl_setopt(, CURLOPT_URL, "https://api-next.livrezone.com/debug2.php");
curl_setopt(, CURLOPT_RETURNTRANSFER, 1);
curl_setopt(, CURLOPT_SSL_VERIFYPEER, false);
 = curl_exec();
curl_close();
echo ;
