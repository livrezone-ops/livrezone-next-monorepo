<?php
$host = '127.0.0.1';
$port = 6060;
$connection = @fsockopen($host, $port, $errno, $errstr, 2);
if (is_resource($connection)) {
    echo "REVERB IS LISTENING ON $host:$port";
    fclose($connection);
} else {
    echo "REVERB IS NOT LISTENING: $errstr ($errno)";
    
    // Let's try 0.0.0.0
    $connection2 = @fsockopen('0.0.0.0', $port, $errno, $errstr, 2);
    if (is_resource($connection2)) {
        echo " | BUT IS LISTENING ON 0.0.0.0:$port";
        fclose($connection2);
    }
}
?>
